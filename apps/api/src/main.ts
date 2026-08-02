import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { RequestContextService } from "./common/request-context";
import { SafeExceptionFilter } from "./common/safe-exception.filter";
import { RuntimeConfigService } from "./config/environment";
import { JsonLogger } from "./observability/json-logger.service";
import { RedisIoAdapter } from "./realtime/redis-io.adapter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get(RuntimeConfigService);
  const logger = app.get(JsonLogger);
  app.useLogger(logger);

  if (config.get("TRUST_PROXY")) app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(json({ limit: config.get("MAX_HTTP_BODY_BYTES"), strict: true }));
  app.use(urlencoded({ extended: false, limit: config.get("MAX_HTTP_BODY_BYTES"), parameterLimit: 100 }));
  app.use(cookieParser());
  app.enableCors({
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["authorization", "content-type", "x-csrf-token", "x-request-id", "traceparent"],
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => callback(null, !origin || config.get("CORS_ORIGINS").includes(origin))
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, stopAtFirstError: false }));
  app.useGlobalFilters(new SafeExceptionFilter(logger, app.get(RequestContextService)));

  const socketAdapter = new RedisIoAdapter(app, config);
  try { await socketAdapter.connect(); app.useWebSocketAdapter(socketAdapter); }
  catch (error) {
    if (config.get("REDIS_REQUIRED")) throw error;
    logger.warn("Socket.IO Redis adapter unavailable; local development delivery only");
  }

  app.enableShutdownHooks(["SIGTERM", "SIGINT"]);
  await app.listen(config.get("PORT"), "0.0.0.0");
  logger.log("API listening", { port: config.get("PORT") });
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level: "fatal", service: "game-store-api", message: "Startup failed", errorName: error instanceof Error ? error.name : "UnknownError" })}\n`);
  process.exitCode = 1;
});
