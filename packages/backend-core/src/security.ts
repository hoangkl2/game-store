import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export interface PasswordHashParameters {
  cost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
  saltLength: number;
}

export const DEFAULT_PASSWORD_HASH_PARAMETERS: Readonly<PasswordHashParameters> = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
  saltLength: 16
};

const derive = (secret: string, salt: Buffer, parameters: PasswordHashParameters): Promise<Buffer> => new Promise((resolve, reject) => {
  const maxmem = Math.max(32 * 1024 * 1024, 128 * parameters.cost * parameters.blockSize * 2);
  scrypt(secret, salt, parameters.keyLength, { N: parameters.cost, r: parameters.blockSize, p: parameters.parallelization, maxmem }, (error, key) => error ? reject(error) : resolve(key));
});

const validatePassword = (password: string): void => {
  const length = Buffer.byteLength(password, "utf8");
  if (length < 8 || length > 1024) throw new Error("Password must be between 8 and 1024 UTF-8 bytes");
};

const parametersAreSafe = (parameters: PasswordHashParameters, saltLength: number): boolean => parameters.cost >= 2 && parameters.cost <= 65536 &&
  (parameters.cost & (parameters.cost - 1)) === 0 && parameters.blockSize >= 1 && parameters.blockSize <= 8 && parameters.parallelization >= 1 &&
  parameters.parallelization <= 4 && parameters.keyLength >= 16 && parameters.keyLength <= 64 && saltLength >= 16 && saltLength <= 64;

export async function hashPassword(password: string, parameters: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS, salt?: Buffer): Promise<string> {
  validatePassword(password);
  if (!parametersAreSafe(parameters, salt?.length ?? parameters.saltLength)) throw new Error("Unsafe password hash parameters");
  const resolvedSalt = salt ?? randomBytes(parameters.saltLength);
  const key = await derive(password, resolvedSalt, parameters);
  return `scrypt$v=1$N=${parameters.cost}$r=${parameters.blockSize}$p=${parameters.parallelization}$${resolvedSalt.toString("base64url")}$${key.toString("base64url")}`;
}

function parsePasswordHash(encoded: string): { parameters: PasswordHashParameters; salt: Buffer; expected: Buffer } | undefined {
  const parts = encoded.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v=1") return undefined;
  const cost = Number(parts[2]?.replace("N=", ""));
  const blockSize = Number(parts[3]?.replace("r=", ""));
  const parallelization = Number(parts[4]?.replace("p=", ""));
  const salt = Buffer.from(parts[5] ?? "", "base64url");
  const expected = Buffer.from(parts[6] ?? "", "base64url");
  const parameters = { cost, blockSize, parallelization, keyLength: expected.length, saltLength: salt.length };
  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelization) || !parametersAreSafe(parameters, salt.length)) return undefined;
  return { parameters, salt, expected };
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parsed = parsePasswordHash(encoded);
  if (!parsed || Buffer.byteLength(password, "utf8") > 1024) return false;
  const actual = await derive(password, parsed.salt, parsed.parameters);
  return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected);
}

export function passwordHashNeedsUpgrade(encoded: string, current: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS): boolean {
  const parsed = parsePasswordHash(encoded);
  return !parsed || parsed.parameters.cost !== current.cost || parsed.parameters.blockSize !== current.blockSize || parsed.parameters.parallelization !== current.parallelization || parsed.parameters.keyLength !== current.keyLength;
}

export const issueOpaqueToken = (bytes = 32): string => {
  if (!Number.isInteger(bytes) || bytes < 32) throw new Error("Opaque tokens require at least 256 bits");
  return randomBytes(bytes).toString("base64url");
};

export const hashOpaqueToken = (token: string): string => {
  if (Buffer.byteLength(token, "utf8") < 32) throw new Error("Token is too short");
  return createHash("sha256").update(token, "utf8").digest("base64url");
};

export type RefreshSessionStatus = "ACTIVE" | "ROTATED" | "REVOKED";
export interface RefreshSessionRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  rotation: number;
  status: RefreshSessionStatus;
  createdAt: string;
  expiresAt: string;
  rotatedAt?: string;
  replacedBySessionId?: string;
  revokedAt?: string;
}

export function createRefreshSession(input: { id: string; userId: string; familyId: string; expiresAt: string; createdAt: string; rotation?: number }, secret = issueOpaqueToken()): { token: string; record: RefreshSessionRecord } {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.id) || !input.userId || !input.familyId || !Number.isFinite(Date.parse(input.createdAt)) || !Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= Date.parse(input.createdAt)) throw new Error("Invalid refresh session input");
  const token = `${input.id}.${secret}`;
  return { token, record: { id: input.id, userId: input.userId, familyId: input.familyId, tokenHash: hashOpaqueToken(token), rotation: input.rotation ?? 0, status: "ACTIVE", createdAt: input.createdAt, expiresAt: input.expiresAt } };
}

export type RefreshRotationResult =
  | { kind: "ROTATED"; previous: RefreshSessionRecord; next: RefreshSessionRecord; token: string }
  | { kind: "INVALID" | "EXPIRED" | "REVOKED" | "REUSE_DETECTED"; revokeFamily: boolean };

export function rotateRefreshSession(current: RefreshSessionRecord, presentedToken: string, nextInput: { id: string; createdAt: string; expiresAt: string }, nextSecret = issueOpaqueToken()): RefreshRotationResult {
  const tokenId = presentedToken.slice(0, presentedToken.indexOf("."));
  let presentedHash = "";
  try { presentedHash = hashOpaqueToken(presentedToken); } catch { return { kind: "INVALID", revokeFamily: false }; }
  const matches = tokenId === current.id && presentedHash.length === current.tokenHash.length && timingSafeEqual(Buffer.from(presentedHash), Buffer.from(current.tokenHash));
  if (current.status === "ROTATED" && matches) return { kind: "REUSE_DETECTED", revokeFamily: true };
  if (current.status !== "ACTIVE") return { kind: "REVOKED", revokeFamily: false };
  if (!matches) return { kind: "INVALID", revokeFamily: false };
  if (Date.parse(current.expiresAt) <= Date.parse(nextInput.createdAt)) return { kind: "EXPIRED", revokeFamily: false };
  const created = createRefreshSession({ id: nextInput.id, userId: current.userId, familyId: current.familyId, createdAt: nextInput.createdAt, expiresAt: nextInput.expiresAt, rotation: current.rotation + 1 }, nextSecret);
  return { kind: "ROTATED", previous: { ...current, status: "ROTATED", rotatedAt: nextInput.createdAt, replacedBySessionId: created.record.id }, next: created.record, token: created.token };
}

export function revokeRefreshFamily(records: readonly RefreshSessionRecord[], revokedAt: string): RefreshSessionRecord[] {
  if (!Number.isFinite(Date.parse(revokedAt))) throw new Error("Invalid revocation time");
  return records.map((record) => ({ ...record, status: "REVOKED", revokedAt }));
}
