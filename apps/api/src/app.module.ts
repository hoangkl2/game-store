import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuditModule } from "./audit/audit.service";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { HttpMetricsMiddleware } from "./common/http-metrics.middleware";
import { CorrelationMiddleware } from "./common/request-context";
import { RuntimeConfigModule } from "./config/config.module";
import { GameModule } from "./game/game.module";
import { HealthModule } from "./health/health.controller";
import { LifecycleModule } from "./lifecycle/lifecycle.module";
import { ObservabilityModule } from "./observability/metrics.service";
import { PrismaModule } from "./prisma/prisma.service";
import { RateLimitModule } from "./rate-limit/rate-limit.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { RedisModule } from "./redis/redis.service";
import { RoomModule } from "./rooms/room.module";

@Module({
  imports: [RuntimeConfigModule, CommonModule, ObservabilityModule, PrismaModule, RedisModule, AuditModule, LifecycleModule, RateLimitModule, AuthModule, GameModule, RoomModule, RealtimeModule, HealthModule],
  providers: [HttpMetricsMiddleware]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware, HttpMetricsMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
