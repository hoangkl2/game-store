import { Global, Injectable, Module } from "@nestjs/common";
import { AuditOutcome, Prisma } from "@prisma/client";
import { redactStructuredMetadata } from "@game-store/backend-core";
import { PrismaService } from "../prisma/prisma.service";
import { RequestContextService } from "../common/request-context";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, private readonly contexts: RequestContextService) {}
  async record(input: { action: string; outcome: AuditOutcome; actorId?: string; subjectId?: string; resourceType?: string; resourceId?: string; metadata?: Record<string, unknown> }): Promise<void> {
    const context = this.contexts.current();
    await this.prisma.auditLog.create({ data: { action: input.action.slice(0, 128), outcome: input.outcome, actorId: input.actorId, subjectId: input.subjectId, resourceType: input.resourceType, resourceId: input.resourceId, requestId: context?.requestId, traceId: context?.traceId, metadata: redactStructuredMetadata(input.metadata ?? {}) as Prisma.InputJsonValue } });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
