import { describe, expect, it } from "vitest";
import type { RuntimeConfigService } from "../config/environment";
import { StateCipherService } from "./state-cipher.service";

const config = { get: () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } as unknown as RuntimeConfigService;

describe("authoritative state cipher", () => {
  it("round-trips state with nondeterministic AES-GCM ciphertext", () => {
    const cipher = new StateCipherService(config); const plaintext = JSON.stringify({ hiddenRole: "DUSK_PROWLER", hand: ["private-card"] });
    const first = cipher.encrypt(plaintext); const second = cipher.encrypt(plaintext);
    expect(first.encryptedPayload).not.toBe(second.encryptedPayload);
    expect(first.encryptedPayload).not.toContain("DUSK_PROWLER");
    expect(cipher.decrypt(first.encryptedPayload, first.checksum)).toBe(plaintext);
  });

  it("rejects malformed payloads, tampering, wrong keys, and checksum mismatch", () => {
    const cipher = new StateCipherService(config); const encrypted = cipher.encrypt("secret-state");
    expect(() => cipher.decrypt("v2.bad.bad.bad", encrypted.checksum)).toThrow("CORRUPT_ENCRYPTED_STATE");
    const tampered = `${encrypted.encryptedPayload.slice(0, -1)}${encrypted.encryptedPayload.endsWith("A") ? "B" : "A"}`;
    expect(() => cipher.decrypt(tampered, encrypted.checksum)).toThrow("CORRUPT_ENCRYPTED_STATE");
    expect(() => cipher.decrypt(encrypted.encryptedPayload, cipher.checksum("different"))).toThrow("CORRUPT_STATE_CHECKSUM");
    const other = new StateCipherService({ get: () => "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" } as unknown as RuntimeConfigService);
    expect(() => other.decrypt(encrypted.encryptedPayload, encrypted.checksum)).toThrow("CORRUPT_ENCRYPTED_STATE");
  });
});
