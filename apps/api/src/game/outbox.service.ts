import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MetricsService } from "../observability/metrics.service";
import { PrismaService } from "../prisma/prisma.service";

export const OUTBOX_COMMITTED_EVENT = "outbox.committed";
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout; private draining = false;
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2, private readonly metrics: MetricsService) {}
  onModuleInit(): void { this.timer = setInterval(() => void this.drain(), 500); this.timer.unref(); }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
  private async drain(): Promise<void> {
    if (this.draining || !this.prisma.status().ready) return; this.draining = true;
    try {
      const [activeRooms, activeSessions] = await Promise.all([
        this.prisma.room.count({ where: { status: { in: ["WAITING", "STARTING", "IN_GAME"] } } }),
        this.prisma.gameSession.count({ where: { status: { in: ["CREATED", "STARTING", "ACTIVE", "PAUSED"] } } })
      ]);
      this.metrics.activeRooms.set(activeRooms); this.metrics.activeSessions.set(activeSessions);
      const pending = await this.prisma.outboxEvent.findMany({ where: { status: "PENDING", availableAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: 20 });
      this.metrics.outboxLag.set(pending[0] ? Math.max(0, (Date.now() - pending[0].createdAt.getTime()) / 1000) : 0);
      for (const event of pending) {
        const claimed = await this.prisma.outboxEvent.updateMany({ where: { id: event.id, status: "PENDING" }, data: { status: "PROCESSING", attempts: { increment: 1 } } }); if (claimed.count !== 1) continue;
        try { await this.events.emitAsync(OUTBOX_COMMITTED_EVENT, { id: event.id, eventType: event.eventType, aggregateId: event.aggregateId, aggregateVersion: event.aggregateVersion, payload: event.payload }); await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { status: "COMPLETED", processedAt: new Date() } }); }
        catch (error) { await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { status: event.attempts >= 9 ? "FAILED" : "PENDING", availableAt: new Date(Date.now() + Math.min(30_000, 2 ** event.attempts * 250)), lastError: error instanceof Error ? error.message.slice(0, 512) : "Outbox delivery failed" } }); }
      }
    } finally { this.draining = false; }
  }
}
