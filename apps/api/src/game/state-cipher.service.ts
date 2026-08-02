import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { RuntimeConfigService } from "../config/environment";

@Injectable()
export class StateCipherService {
  private readonly key: Buffer;
  constructor(config: RuntimeConfigService) { this.key = Buffer.from(config.get("STATE_ENCRYPTION_KEY"), "base64url"); }
  checksum(plaintext: string): string { return createHash("sha256").update(plaintext, "utf8").digest("base64url"); }
  encrypt(plaintext: string): { encryptedPayload: string; checksum: string } {
    const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.key, iv); const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]); const tag = cipher.getAuthTag();
    return { encryptedPayload: `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`, checksum: this.checksum(plaintext) };
  }
  decrypt(payload: string, expectedChecksum: string): string {
    const [version, iv, tag, ciphertext] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("CORRUPT_ENCRYPTED_STATE");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
      if (this.checksum(plaintext) !== expectedChecksum) throw new Error("CORRUPT_STATE_CHECKSUM");
      return plaintext;
    } catch (error) { if (error instanceof Error && error.message === "CORRUPT_STATE_CHECKSUM") throw error; throw new Error("CORRUPT_ENCRYPTED_STATE"); }
  }
}
