const defaults: Record<string, string> = {
  NODE_ENV: "test", PORT: "4000", INSTANCE_ID: "api-e2e-1",
  DATABASE_URL: "postgresql://game_store:local_dev_credential@127.0.0.1:5432/game_store?schema=public", DATABASE_REQUIRED: "true",
  REDIS_URL: "redis://127.0.0.1:6379", REDIS_REQUIRED: "true", REDIS_KEY_PREFIX: "gs:test:v1:",
  ACCESS_TOKEN_SECRET: "e2e-access-token-secret-at-least-32-bytes", ACCESS_TOKEN_ISSUER: "game-store-api", ACCESS_TOKEN_AUDIENCE: "game-store-web",
  ACCESS_TOKEN_TTL_SECONDS: "600", REFRESH_TOKEN_TTL_SECONDS: "86400", STATE_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  COOKIE_SECURE: "false", COOKIE_SAME_SITE: "lax", CORS_ORIGINS: "http://localhost:3000", CSRF_COOKIE_NAME: "gs_csrf", REFRESH_COOKIE_NAME: "gs_refresh",
  MAX_HTTP_BODY_BYTES: "16384", MAX_SOCKET_PAYLOAD_BYTES: "8192", TRUST_PROXY: "false"
};
for (const [key, value] of Object.entries(defaults)) process.env[key] ??= value;
