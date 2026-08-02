import { Controller, Get, Header, Headers, HttpException, HttpStatus, Module } from "@nestjs/common";
import { RuntimeConfigService } from "../config/environment";
import { MetricsService } from "../observability/metrics.service";
import { LifecycleService } from "../lifecycle/lifecycle.module";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Controller()
export class HealthController {
  constructor(private readonly config: RuntimeConfigService, private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly metrics: MetricsService, private readonly lifecycle: LifecycleService) {}
  @Get("health/live") live() { return { status: "ok", instanceId: this.config.get("INSTANCE_ID"), timestamp: new Date().toISOString() }; }
  @Get("health/ready") async ready() {
    const database = this.prisma.status(); const redis = this.redis.status();
    const ready = !this.lifecycle.isDraining() && (!this.config.get("DATABASE_REQUIRED") || database.ready) && (!this.config.get("REDIS_REQUIRED") || redis.ready);
    if (!ready) throw new HttpException({ status: "not-ready", database: database.ready, redis: redis.ready }, HttpStatus.SERVICE_UNAVAILABLE);
    try {
      const [databaseLatencyMs, redisLatencyMs] = await Promise.all([this.config.get("DATABASE_REQUIRED") ? this.prisma.ping() : Promise.resolve(undefined), this.config.get("REDIS_REQUIRED") ? this.redis.ping() : Promise.resolve(undefined)]);
      return { status: "ready", database: database.ready, redis: redis.ready, databaseLatencyMs, redisLatencyMs, instanceId: this.config.get("INSTANCE_ID") };
    } catch { throw new HttpException({ status: "not-ready", database: false, redis: false }, HttpStatus.SERVICE_UNAVAILABLE); }
  }
  @Get("health") detail(@Headers("authorization") authorization?: string) {
    if (this.config.isProduction && authorization !== `Bearer ${this.config.get("METRICS_TOKEN")}`) throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    return { status: "ok", instanceId: this.config.get("INSTANCE_ID"), environment: this.config.get("NODE_ENV"), database: { ready: this.prisma.status().ready }, redis: { ready: this.redis.status().ready }, protocolVersion: 1 };
  }
  @Get("metrics") @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8") async renderMetrics(@Headers("authorization") authorization?: string) {
    if (this.config.isProduction && authorization !== `Bearer ${this.config.get("METRICS_TOKEN")}`) throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    return this.metrics.render();
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
