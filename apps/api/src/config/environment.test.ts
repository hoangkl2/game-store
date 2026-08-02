import { describe, expect, it } from "vitest";
import type { ConfigService } from "@nestjs/config";
import { RuntimeConfigService, type RuntimeEnvironment, validateEnvironment } from "./environment";

const base = () => ({
  NODE_ENV: "test", PORT: "4000", INSTANCE_ID: "api-test-1",
  DATABASE_URL: "postgresql://game_store:credential@localhost:5432/game_store", DATABASE_REQUIRED: "true",
  REDIS_URL: "redis://localhost:6379", REDIS_REQUIRED: "true", REDIS_KEY_PREFIX: "gs:test:v1:",
  ACCESS_TOKEN_SECRET: "a-secure-access-token-secret-over-32-bytes", ACCESS_TOKEN_ISSUER: "game-store-api", ACCESS_TOKEN_AUDIENCE: "game-store-web",
  ACCESS_TOKEN_TTL_SECONDS: "600", REFRESH_TOKEN_TTL_SECONDS: "86400", STATE_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  COOKIE_SECURE: "false", COOKIE_SAME_SITE: "lax", CORS_ORIGINS: "http://localhost:3000,https://preview.invalid/",
  CSRF_COOKIE_NAME: "gs_csrf", REFRESH_COOKIE_NAME: "gs_refresh", MAX_HTTP_BODY_BYTES: "16384", MAX_SOCKET_PAYLOAD_BYTES: "8192", TRUST_PROXY: "false"
});

describe("runtime environment validation", () => {
  it("parses and normalizes an explicit non-production environment", () => {
    const result = validateEnvironment(base());
    expect(result).toMatchObject({ PORT: 4000, DATABASE_REQUIRED: true, COOKIE_SECURE: false, CORS_ORIGINS: ["http://localhost:3000", "https://preview.invalid"] });
    const runtime = new RuntimeConfigService({ get: (key: keyof RuntimeEnvironment) => result[key] } as unknown as ConfigService<RuntimeEnvironment, true>);
    expect(runtime.get("PORT")).toBe(4000); expect(runtime.isProduction).toBe(false);
  });

  it("accepts only hardened production dependencies, origins, cookies, and metrics", () => {
    const input = { ...base(), NODE_ENV: "production", DATABASE_URL: "postgresql://role:secret@db.internal:5432/game_store?sslmode=require", REDIS_URL: "rediss://:secret@redis.internal:6380", COOKIE_SECURE: "true", CORS_ORIGINS: "https://games.invalid", METRICS_TOKEN: "a-secure-metrics-token-secret-over-32-bytes", TRUST_PROXY: "true" };
    const production = validateEnvironment(input);
    expect(production).toMatchObject({ NODE_ENV: "production", COOKIE_SECURE: true, TRUST_PROXY: true });
    expect(new RuntimeConfigService({ get: (key: keyof RuntimeEnvironment) => production[key] } as unknown as ConfigService<RuntimeEnvironment, true>).isProduction).toBe(true);
    expect(() => validateEnvironment({ ...input, COOKIE_SECURE: "false" })).toThrow("Production requires");
    expect(() => validateEnvironment({ ...input, DATABASE_URL: base().DATABASE_URL })).toThrow("require TLS");
    expect(() => validateEnvironment({ ...input, REDIS_URL: base().REDIS_URL })).toThrow("use TLS");
    expect(() => validateEnvironment({ ...input, CORS_ORIGINS: "https://games.invalid/path" })).toThrow("without paths");
    expect(() => validateEnvironment({ ...input, CORS_ORIGINS: "http://localhost:3000" })).toThrow("non-loopback HTTPS");
    expect(() => validateEnvironment({ ...input, METRICS_TOKEN: "" })).toThrow("METRICS_TOKEN");
  });

  it("rejects malformed protocols, booleans, limits, secrets, keys, and SameSite values", () => {
    expect(() => validateEnvironment({ ...base(), DATABASE_URL: "mysql://localhost/db" })).toThrow("PostgreSQL");
    expect(() => validateEnvironment({ ...base(), REDIS_URL: "http://localhost" })).toThrow("Redis");
    expect(() => validateEnvironment({ ...base(), DATABASE_REQUIRED: "yes" })).toThrow("true or false");
    expect(() => validateEnvironment({ ...base(), PORT: "0" })).toThrow("integer");
    expect(() => validateEnvironment({ ...base(), ACCESS_TOKEN_SECRET: "change-me-with-an-example-password-123" })).toThrow("unsafe placeholder");
    expect(() => validateEnvironment({ ...base(), STATE_ENCRYPTION_KEY: `!${"A".repeat(42)}` })).toThrow("32-byte base64url");
    expect(() => validateEnvironment({ ...base(), COOKIE_SAME_SITE: "none" })).toThrow("strict or lax");
    expect(() => validateEnvironment({ ...base(), NODE_ENV: "staging" })).toThrow("development, test, or production");
  });
});
