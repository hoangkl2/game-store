import { Injectable, NestMiddleware } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface RequestContext { requestId: string; traceId: string; startedAt: number }
const safeId = /^[a-zA-Z0-9_-]{8,128}$/;

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();
  run<T>(context: RequestContext, callback: () => T): T { return this.storage.run(context, callback); }
  current(): RequestContext | undefined { return this.storage.getStore(); }
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly contexts: RequestContextService) {}
  use(request: Request, response: Response, next: NextFunction): void {
    const requestedId = request.header("x-request-id");
    const traceparent = request.header("traceparent");
    const requestId = requestedId && safeId.test(requestedId) ? requestedId : randomUUID();
    const traceId = traceparent && /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/i.test(traceparent) ? traceparent.split("-")[1]! : randomUUID().replaceAll("-", "");
    response.setHeader("x-request-id", requestId);
    this.contexts.run({ requestId, traceId, startedAt: performance.now() }, next);
  }
}
