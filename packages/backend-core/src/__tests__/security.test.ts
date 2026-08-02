import { describe, expect, it } from "vitest";
import { createRefreshSession, hashOpaqueToken, hashPassword, issueOpaqueToken, passwordHashNeedsUpgrade, revokeRefreshFamily, rotateRefreshSession, verifyPassword, type PasswordHashParameters } from "../security";

const fastParameters: PasswordHashParameters = { cost: 1024, blockSize: 8, parallelization: 1, keyLength: 32, saltLength: 16 };
const salt = Buffer.alloc(16, 7);

describe("password and opaque-token security", () => {
  it("hashes and verifies Vietnamese passwords without storing plaintext", async () => {
    const password = "Mặt-trăng-2026";
    const encoded = await hashPassword(password, fastParameters, salt);
    expect(encoded).toMatch(/^scrypt\$v=1\$N=1024\$/);
    expect(encoded).not.toContain(password);
    expect(await verifyPassword(password, encoded)).toBe(true);
    expect(await verifyPassword("incorrect-password", encoded)).toBe(false);
    expect(await verifyPassword(password, "malformed")).toBe(false);
    expect(passwordHashNeedsUpgrade(encoded, fastParameters)).toBe(false);
    expect(passwordHashNeedsUpgrade(encoded)).toBe(true);
    expect(passwordHashNeedsUpgrade("malformed", fastParameters)).toBe(true);
  });

  it("rejects weak parameters, oversized credentials, and short opaque tokens", async () => {
    await expect(hashPassword("short", fastParameters, salt)).rejects.toThrow("between 8");
    await expect(hashPassword("a".repeat(1025), fastParameters, salt)).rejects.toThrow("between 8");
    await expect(hashPassword("valid-password", { ...fastParameters, cost: 1000 }, salt)).rejects.toThrow("Unsafe");
    await expect(hashPassword("valid-password", { ...fastParameters, cost: 131072 })).rejects.toThrow("Unsafe");
    expect(await verifyPassword("a".repeat(1025), await hashPassword("valid-password", fastParameters, salt))).toBe(false);
    expect(() => issueOpaqueToken(31)).toThrow("256 bits");
    expect(issueOpaqueToken()).toHaveLength(43);
    expect(() => hashOpaqueToken("too-short")).toThrow("too short");
    expect(hashOpaqueToken("x".repeat(32))).toHaveLength(43);
  });
});

describe("refresh-session rotation", () => {
  const createdAt = "2026-08-02T00:00:00.000Z";
  const expiresAt = "2026-08-09T00:00:00.000Z";

  it("rotates a hashed token and detects replay of the old token", () => {
    const initial = createRefreshSession({ id: "session-1", userId: "user-1", familyId: "family-1", createdAt, expiresAt }, "a".repeat(43));
    expect(initial.record.tokenHash).not.toContain(initial.token);
    const rotated = rotateRefreshSession(initial.record, initial.token, { id: "session-2", createdAt: "2026-08-03T00:00:00.000Z", expiresAt: "2026-08-10T00:00:00.000Z" }, "b".repeat(43));
    expect(rotated.kind).toBe("ROTATED");
    if (rotated.kind !== "ROTATED") throw new Error("Expected rotation");
    expect(rotated.previous).toMatchObject({ status: "ROTATED", replacedBySessionId: "session-2" });
    expect(rotated.next).toMatchObject({ familyId: "family-1", rotation: 1, status: "ACTIVE" });
    expect(rotateRefreshSession(rotated.previous, initial.token, { id: "session-3", createdAt: "2026-08-04T00:00:00.000Z", expiresAt: "2026-08-11T00:00:00.000Z" }, "c".repeat(43))).toEqual({ kind: "REUSE_DETECTED", revokeFamily: true });
    expect(revokeRefreshFamily([rotated.previous, rotated.next], "2026-08-04T00:00:00.000Z").every((record) => record.status === "REVOKED")).toBe(true);
  });

  it("rejects invalid, expired, and revoked refresh credentials", () => {
    const initial = createRefreshSession({ id: "session-1", userId: "user-1", familyId: "family-1", createdAt, expiresAt }, "a".repeat(43));
    const next = { id: "session-2", createdAt: "2026-08-03T00:00:00.000Z", expiresAt: "2026-08-10T00:00:00.000Z" };
    expect(rotateRefreshSession(initial.record, "bad", next, "b".repeat(43))).toEqual({ kind: "INVALID", revokeFamily: false });
    expect(rotateRefreshSession(initial.record, `other.${"z".repeat(43)}`, next, "b".repeat(43))).toEqual({ kind: "INVALID", revokeFamily: false });
    expect(rotateRefreshSession({ ...initial.record, expiresAt: createdAt }, initial.token, next, "b".repeat(43))).toEqual({ kind: "EXPIRED", revokeFamily: false });
    expect(rotateRefreshSession({ ...initial.record, status: "REVOKED" }, initial.token, next, "b".repeat(43))).toEqual({ kind: "REVOKED", revokeFamily: false });
    expect(() => createRefreshSession({ id: "", userId: "u", familyId: "f", createdAt, expiresAt }, "a".repeat(43))).toThrow("Invalid refresh");
    expect(() => createRefreshSession({ id: "bad.id", userId: "u", familyId: "f", createdAt, expiresAt }, "a".repeat(43))).toThrow("Invalid refresh");
    expect(() => revokeRefreshFamily([], "invalid")).toThrow("Invalid revocation");
  });
});
