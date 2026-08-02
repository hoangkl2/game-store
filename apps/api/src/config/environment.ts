import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type RuntimeNodeEnvironment = "development" | "test" | "production";
export type RuntimeSameSite = "strict" | "lax";

export interface RuntimeEnvironment {
  NODE_ENV: RuntimeNodeEnvironment;
  PORT: number;
  INSTANCE_ID: string;
  DATABASE_URL: string;
  DATABASE_REQUIRED: boolean;
  REDIS_URL: string;
  REDIS_REQUIRED: boolean;
  REDIS_KEY_PREFIX: string;
  ACCESS_TOKEN_SECRET: string;
  ACCESS_TOKEN_ISSUER: string;
  ACCESS_TOKEN_AUDIENCE: string;
  ACCESS_TOKEN_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_SECONDS: number;
  STATE_ENCRYPTION_KEY: string;
  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: RuntimeSameSite;
  CORS_ORIGINS: string[];
  CSRF_COOKIE_NAME: string;
  REFRESH_COOKIE_NAME: string;
  MAX_HTTP_BODY_BYTES: number;
  MAX_SOCKET_PAYLOAD_BYTES: number;
  METRICS_TOKEN?: string;
  TRUST_PROXY: boolean;
}

const boolean = (value: unknown, name: string): boolean => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error(`${name} must be true or false`);
};

const integer = (value: unknown, name: string, minimum: number, maximum: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  return parsed;
};

const text = (value: unknown, name: string, minimum = 1): string => {
  if (typeof value !== "string" || value.trim().length < minimum) throw new Error(`${name} is required`);
  return value.trim();
};

const secret = (value: unknown, name: string): string => {
  const resolved = text(value, name, 32);
  if (/development|change-me|example|password/i.test(resolved)) throw new Error(`${name} uses an unsafe placeholder`);
  return resolved;
};

const encryptionKey = (value: unknown): string => {
  const resolved = text(value, "STATE_ENCRYPTION_KEY", 43);
  if (!/^[A-Za-z0-9_-]{43}$/.test(resolved) || Buffer.from(resolved, "base64url").length !== 32) throw new Error("STATE_ENCRYPTION_KEY must be a 32-byte base64url value");
  return resolved;
};

const origins = (value: unknown): string[] => text(value, "CORS_ORIGINS").split(",").map((entry) => {
  const origin = new URL(entry.trim()).origin;
  if (origin !== entry.trim().replace(/\/$/, "")) throw new Error("CORS_ORIGINS must contain origins without paths");
  return origin;
});

export function validateEnvironment(raw: Record<string, unknown>): RuntimeEnvironment {
  const nodeEnvironment = text(raw.NODE_ENV, "NODE_ENV") as RuntimeNodeEnvironment;
  if (!(["development", "test", "production"] as const).includes(nodeEnvironment)) throw new Error("NODE_ENV must be development, test, or production");
  const databaseUrl = text(raw.DATABASE_URL, "DATABASE_URL");
  const redisUrl = text(raw.REDIS_URL, "REDIS_URL");
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) throw new Error("DATABASE_URL must use PostgreSQL");
  if (!redisUrl.startsWith("redis://") && !redisUrl.startsWith("rediss://")) throw new Error("REDIS_URL must use Redis");
  const cookieSecure = boolean(raw.COOKIE_SECURE, "COOKIE_SECURE");
  const databaseRequired = boolean(raw.DATABASE_REQUIRED, "DATABASE_REQUIRED");
  const redisRequired = boolean(raw.REDIS_REQUIRED, "REDIS_REQUIRED");
  const allowedOrigins = origins(raw.CORS_ORIGINS);
  if (nodeEnvironment === "production") {
    if (!cookieSecure || !databaseRequired || !redisRequired) throw new Error("Production requires secure cookies, PostgreSQL, and Redis");
    if (allowedOrigins.some((origin) => !origin.startsWith("https://") || /localhost|127\.0\.0\.1/.test(origin))) throw new Error("Production CORS origins must be non-loopback HTTPS origins");
    if (!databaseUrl.includes("sslmode=require")) throw new Error("Production DATABASE_URL must require TLS");
    if (!redisUrl.startsWith("rediss://")) throw new Error("Production REDIS_URL must use TLS");
  }
  const sameSite = text(raw.COOKIE_SAME_SITE, "COOKIE_SAME_SITE").toLowerCase();
  if (sameSite !== "strict" && sameSite !== "lax") throw new Error("COOKIE_SAME_SITE must be strict or lax");
  const metricsToken = raw.METRICS_TOKEN === undefined || raw.METRICS_TOKEN === "" ? undefined : secret(raw.METRICS_TOKEN, "METRICS_TOKEN");
  if (nodeEnvironment === "production" && !metricsToken) throw new Error("Production requires METRICS_TOKEN");
  return {
    NODE_ENV: nodeEnvironment,
    PORT: integer(raw.PORT, "PORT", 1, 65535),
    INSTANCE_ID: text(raw.INSTANCE_ID, "INSTANCE_ID", 3),
    DATABASE_URL: databaseUrl,
    DATABASE_REQUIRED: databaseRequired,
    REDIS_URL: redisUrl,
    REDIS_REQUIRED: redisRequired,
    REDIS_KEY_PREFIX: text(raw.REDIS_KEY_PREFIX, "REDIS_KEY_PREFIX", 3),
    ACCESS_TOKEN_SECRET: secret(raw.ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET"),
    ACCESS_TOKEN_ISSUER: text(raw.ACCESS_TOKEN_ISSUER, "ACCESS_TOKEN_ISSUER", 3),
    ACCESS_TOKEN_AUDIENCE: text(raw.ACCESS_TOKEN_AUDIENCE, "ACCESS_TOKEN_AUDIENCE", 3),
    ACCESS_TOKEN_TTL_SECONDS: integer(raw.ACCESS_TOKEN_TTL_SECONDS, "ACCESS_TOKEN_TTL_SECONDS", 60, 3600),
    REFRESH_TOKEN_TTL_SECONDS: integer(raw.REFRESH_TOKEN_TTL_SECONDS, "REFRESH_TOKEN_TTL_SECONDS", 3600, 60 * 60 * 24 * 90),
    STATE_ENCRYPTION_KEY: encryptionKey(raw.STATE_ENCRYPTION_KEY),
    COOKIE_SECURE: cookieSecure,
    COOKIE_SAME_SITE: sameSite,
    CORS_ORIGINS: allowedOrigins,
    CSRF_COOKIE_NAME: text(raw.CSRF_COOKIE_NAME, "CSRF_COOKIE_NAME", 3),
    REFRESH_COOKIE_NAME: text(raw.REFRESH_COOKIE_NAME, "REFRESH_COOKIE_NAME", 3),
    MAX_HTTP_BODY_BYTES: integer(raw.MAX_HTTP_BODY_BYTES, "MAX_HTTP_BODY_BYTES", 1024, 65536),
    MAX_SOCKET_PAYLOAD_BYTES: integer(raw.MAX_SOCKET_PAYLOAD_BYTES, "MAX_SOCKET_PAYLOAD_BYTES", 1024, 65536),
    METRICS_TOKEN: metricsToken,
    TRUST_PROXY: boolean(raw.TRUST_PROXY, "TRUST_PROXY")
  };
}

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly config: ConfigService<RuntimeEnvironment, true>) {}
  get<K extends keyof RuntimeEnvironment>(key: K): RuntimeEnvironment[K] { return this.config.get(key, { infer: true }); }
  get isProduction(): boolean { return this.get("NODE_ENV") === "production"; }
}
