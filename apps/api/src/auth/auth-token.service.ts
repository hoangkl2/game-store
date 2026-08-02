import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import { RuntimeConfigService } from "../config/environment";
import { PrismaService } from "../prisma/prisma.service";
import type { AccessTokenClaims, AuthPrincipal } from "./auth.types";

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwt: JwtService, private readonly config: RuntimeConfigService, private readonly prisma: PrismaService) {}
  async issue(claims: Omit<AccessTokenClaims, "type">): Promise<string> {
    return this.jwt.signAsync({ ...claims, type: "access" }, { secret: this.config.get("ACCESS_TOKEN_SECRET"), issuer: this.config.get("ACCESS_TOKEN_ISSUER"), audience: this.config.get("ACCESS_TOKEN_AUDIENCE"), expiresIn: this.config.get("ACCESS_TOKEN_TTL_SECONDS") });
  }
  async verify(token: string): Promise<AuthPrincipal> {
    try {
      const claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, { secret: this.config.get("ACCESS_TOKEN_SECRET"), issuer: this.config.get("ACCESS_TOKEN_ISSUER"), audience: this.config.get("ACCESS_TOKEN_AUDIENCE") });
      if (claims.type !== "access" || !claims.sub || !claims.sid || !Number.isInteger(claims.epoch)) throw new Error("Invalid claims");
      const user = await this.prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, status: true, authEpoch: true, role: true } });
      const session = await this.prisma.authSession.findUnique({ where: { id: claims.sid }, select: { userId: true, status: true, expiresAt: true } });
      if (!user || user.status !== UserStatus.ACTIVE || user.authEpoch !== claims.epoch || !session || session.userId !== user.id || session.status !== "ACTIVE" || session.expiresAt <= new Date()) throw new Error("Revoked identity");
      return { identityId: user.id, userId: user.id, sessionId: claims.sid, authEpoch: user.authEpoch, role: user.role };
    } catch { throw new UnauthorizedException("Authentication expired or revoked"); }
  }
}
