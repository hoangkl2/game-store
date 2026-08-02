import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { RuntimeConfigService } from "../config/environment";
import { MetricsService } from "../observability/metrics.service";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private ready = false;
  private lastError?: string;
  constructor(private readonly runtimeConfig: RuntimeConfigService, private readonly metrics: MetricsService) {
    super({ datasources: { db: { url: runtimeConfig.get("DATABASE_URL") } }, errorFormat: "minimal" });
  }
  async onModuleInit(): Promise<void> {
    try { await this.$connect(); await this.ping(); this.ready = true; }
    catch (error) { this.lastError = error instanceof Error ? error.message.slice(0, 256) : "Database connection failed"; this.metrics.dependencyFailures.inc({ dependency: "postgresql" }); if (this.runtimeConfig.get("DATABASE_REQUIRED")) throw error; }
  }
  async onModuleDestroy(): Promise<void> { this.ready = false; await this.$disconnect(); }
  async ping(): Promise<number> { const started = performance.now(); await this.$queryRaw`SELECT 1`; const milliseconds = performance.now() - started; this.metrics.databaseDuration.observe({ operation: "ping" }, milliseconds / 1000); return milliseconds; }
  status(): { ready: boolean; error?: string } { return { ready: this.ready, error: this.lastError }; }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
