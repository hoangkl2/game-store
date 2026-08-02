import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthSessionStatus, Prisma, UserStatus } from "@prisma/client";
import { createRefreshSession, hashOpaqueToken, hashPassword, issueOpaqueToken, rotateRefreshSession, verifyPassword } from "@game-store/backend-core";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { RuntimeConfigService } from "../config/environment";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokenService } from "./auth-token.service";

const normalizeEmail = (email: string) => email.normalize("NFKC").trim().toLowerCase();
const normalizeHandle = (name: string) => name.normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 20) || "player";
const DUMMY_PASSWORD_HASH = "scrypt$v=1$N=16384$r=8$p=1$S4Qib29Iz7CpIm-FuUSY7g$EE5mmsAvCl4QaPpV36bp8ayM6OHl4T-0yvYTI9Znmbc";
const retrySerializable = async <T>(operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") || attempt >= 2) throw error;
    }
  }
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly tokens: AuthTokenService, private readonly config: RuntimeConfigService, private readonly audit: AuditService) {}

  async register(input: { email: string; password: string; displayName: string; deviceLabel: string }) {
    const normalizedEmail = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    try {
      return await retrySerializable(() => this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({ data: { normalizedEmail, passwordHash, profile: { create: { normalizedHandle: `${normalizeHandle(input.displayName)}-${randomUUID().slice(0, 8)}`, displayName: input.displayName.normalize("NFKC").trim() } } }, include: { profile: true } });
        const session = await this.createLoginSession(user, input.deviceLabel, transaction);
        await transaction.auditLog.create({ data: { action: "auth.register", outcome: "SUCCESS", actorId: user.id, subjectId: user.id } });
        return session;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Account already exists");
      throw error;
    }
  }

  async login(input: { email: string; password: string; deviceLabel: string }) {
    const user = await this.prisma.user.findUnique({ where: { normalizedEmail: normalizeEmail(input.email) }, include: { profile: true } });
    const passwordValid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || user.status !== UserStatus.ACTIVE || !passwordValid) {
      await this.audit.record({ action: "auth.login", outcome: "DENIED", metadata: { reason: "invalid_credentials" } });
      throw new UnauthorizedException("Invalid credentials");
    }
    return retrySerializable(() => this.prisma.$transaction(async (transaction) => {
      const session = await this.createLoginSession(user, input.deviceLabel, transaction);
      await transaction.auditLog.create({ data: { action: "auth.login", outcome: "SUCCESS", actorId: user.id, subjectId: user.id } });
      return session;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  private async createLoginSession(user: { id: string; authEpoch: number; role: "PLAYER" | "MODERATOR" | "ADMINISTRATOR" | "SUPPORT"; profile: { displayName: string } | null }, deviceLabel: string, database: Pick<Prisma.TransactionClient, "authSession"> = this.prisma) {
    const now = new Date(); const expiresAt = new Date(now.getTime() + this.config.get("REFRESH_TOKEN_TTL_SECONDS") * 1000);
    const sessionId = randomUUID(); const familyId = randomUUID(); const refresh = createRefreshSession({ id: sessionId, userId: user.id, familyId, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
    const csrfToken = issueOpaqueToken();
    await database.authSession.create({ data: { id: sessionId, userId: user.id, familyId, tokenHash: refresh.record.tokenHash, csrfTokenHash: hashOpaqueToken(csrfToken), rotation: 0, status: AuthSessionStatus.ACTIVE, deviceLabel: deviceLabel.slice(0, 128), expiresAt } });
    const accessToken = await this.tokens.issue({ sub: user.id, sid: sessionId, epoch: user.authEpoch, role: user.role });
    return { accessToken, refreshToken: refresh.token, csrfToken, user: { id: user.id, displayName: user.profile?.displayName ?? "Player", role: user.role } };
  }

  async refresh(presentedToken: string, csrfToken: string) {
    const separator = presentedToken.indexOf("."); const sessionId = separator > 0 ? presentedToken.slice(0, separator) : "";
    if (!sessionId) throw new UnauthorizedException("Refresh session expired or revoked");
    const result = await retrySerializable(() => this.prisma.$transaction(async (transaction) => {
      const current = await transaction.authSession.findUnique({ where: { id: sessionId }, include: { user: { include: { profile: true } } } });
      const presentedCsrf = hashOpaqueToken(csrfToken);
      if (!current || presentedCsrf.length !== current.csrfTokenHash.length || !timingSafeEqual(Buffer.from(presentedCsrf), Buffer.from(current.csrfTokenHash))) throw new UnauthorizedException("Refresh session expired or revoked");
      const rotation = rotateRefreshSession({ id: current.id, userId: current.userId, familyId: current.familyId, tokenHash: current.tokenHash, rotation: current.rotation, status: current.status === "ACTIVE" ? "ACTIVE" : current.status === "ROTATED" ? "ROTATED" : "REVOKED", createdAt: current.createdAt.toISOString(), expiresAt: current.expiresAt.toISOString() }, presentedToken, { id: randomUUID(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + this.config.get("REFRESH_TOKEN_TTL_SECONDS") * 1000).toISOString() });
      if (rotation.kind === "REUSE_DETECTED") {
        await transaction.authSession.updateMany({ where: { familyId: current.familyId }, data: { status: AuthSessionStatus.REVOKED, revokedAt: new Date() } });
        await transaction.user.update({ where: { id: current.userId }, data: { authEpoch: { increment: 1 } } });
        await transaction.auditLog.create({ data: { action: "auth.refresh_reuse", outcome: "DENIED", actorId: current.userId, subjectId: current.userId } });
        return { kind: "REUSE" as const, userId: current.userId };
      }
      if (rotation.kind !== "ROTATED" || current.user.status !== UserStatus.ACTIVE) throw new UnauthorizedException("Refresh session expired or revoked");
      const nextCsrf = issueOpaqueToken();
      await transaction.authSession.update({ where: { id: current.id }, data: { status: AuthSessionStatus.ROTATED, rotatedAt: new Date(rotation.previous.rotatedAt!), replacedBySessionId: rotation.next.id, lastUsedAt: new Date() } });
      await transaction.authSession.create({ data: { id: rotation.next.id, userId: current.userId, familyId: current.familyId, tokenHash: rotation.next.tokenHash, csrfTokenHash: hashOpaqueToken(nextCsrf), rotation: rotation.next.rotation, status: AuthSessionStatus.ACTIVE, deviceLabel: current.deviceLabel, expiresAt: new Date(rotation.next.expiresAt) } });
      await transaction.auditLog.create({ data: { action: "auth.refresh", outcome: "SUCCESS", actorId: current.userId, subjectId: current.userId } });
      return { kind: "ROTATED" as const, user: current.user, sessionId: rotation.next.id, refreshToken: rotation.token, csrfToken: nextCsrf };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    if (result.kind === "REUSE") throw new UnauthorizedException("Refresh-token reuse detected; session family revoked");
    const accessToken = await this.tokens.issue({ sub: result.user.id, sid: result.sessionId, epoch: result.user.authEpoch, role: result.user.role });
    return { accessToken, refreshToken: result.refreshToken, csrfToken: result.csrfToken };
  }

  async logoutCurrent(userId: string, sessionId: string): Promise<void> {
    await this.prisma.$transaction([this.prisma.authSession.updateMany({ where: { id: sessionId, userId, status: AuthSessionStatus.ACTIVE }, data: { status: AuthSessionStatus.REVOKED, revokedAt: new Date() } }), this.prisma.auditLog.create({ data: { action: "auth.logout", outcome: "SUCCESS", actorId: userId, subjectId: userId } })]);
  }
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction([this.prisma.authSession.updateMany({ where: { userId, status: { in: [AuthSessionStatus.ACTIVE, AuthSessionStatus.ROTATED] } }, data: { status: AuthSessionStatus.REVOKED, revokedAt: new Date() } }), this.prisma.user.update({ where: { id: userId }, data: { authEpoch: { increment: 1 } } }), this.prisma.auditLog.create({ data: { action: "auth.logout_all", outcome: "SUCCESS", actorId: userId, subjectId: userId } })]);
  }
}
