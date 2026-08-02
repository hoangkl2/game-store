import { Global, Injectable, Module, OnModuleDestroy } from "@nestjs/common";
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";
import { JsonLogger } from "./json-logger.service";

@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new Registry();
  readonly httpDuration = new Histogram({ name: "game_store_http_duration_seconds", help: "HTTP request duration", labelNames: ["method", "route", "status"] as const, registers: [this.registry] });
  readonly actionDuration = new Histogram({ name: "game_store_action_duration_seconds", help: "Authoritative action duration", labelNames: ["game", "outcome"] as const, registers: [this.registry] });
  readonly actions = new Counter({ name: "game_store_actions_total", help: "Authoritative action outcomes", labelNames: ["outcome"] as const, registers: [this.registry] });
  readonly reconnects = new Counter({ name: "game_store_reconnect_total", help: "Reconnect outcomes", labelNames: ["outcome"] as const, registers: [this.registry] });
  readonly projectionFailures = new Counter({ name: "game_store_projection_failures_total", help: "Projection failures", registers: [this.registry] });
  readonly dependencyFailures = new Counter({ name: "game_store_dependency_failures_total", help: "Dependency failures", labelNames: ["dependency"] as const, registers: [this.registry] });
  readonly databaseDuration = new Histogram({ name: "game_store_database_duration_seconds", help: "Database operation duration", labelNames: ["operation"] as const, registers: [this.registry] });
  readonly socketConnections = new Gauge({ name: "game_store_socket_connections", help: "Active Socket.IO connections", registers: [this.registry] });
  readonly activeRooms = new Gauge({ name: "game_store_active_rooms", help: "Active durable rooms", registers: [this.registry] });
  readonly activeSessions = new Gauge({ name: "game_store_active_sessions", help: "Active durable game sessions", registers: [this.registry] });
  readonly outboxLag = new Gauge({ name: "game_store_outbox_oldest_pending_seconds", help: "Age of the oldest pending outbox event", registers: [this.registry] });
  constructor() { collectDefaultMetrics({ register: this.registry, prefix: "game_store_process_" }); }
  onModuleDestroy(): void { this.registry.clear(); }
  async render(): Promise<string> { return this.registry.metrics(); }
}

@Global()
@Module({ providers: [MetricsService, JsonLogger], exports: [MetricsService, JsonLogger] })
export class ObservabilityModule {}
