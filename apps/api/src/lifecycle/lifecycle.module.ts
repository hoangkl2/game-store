import { BeforeApplicationShutdown, CanActivate, ExecutionContext, Global, HttpException, HttpStatus, Injectable, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import type { Request } from "express";

@Injectable()
export class LifecycleService implements BeforeApplicationShutdown {
  private draining = false;
  beforeApplicationShutdown(): void { this.draining = true; }
  isDraining(): boolean { return this.draining; }
}

@Injectable()
class DrainGuard implements CanActivate {
  constructor(private readonly lifecycle: LifecycleService) {}
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http" || !this.lifecycle.isDraining()) return true;
    const method = context.switchToHttp().getRequest<Request>().method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
    throw new HttpException({ code: "INSTANCE_DRAINING", retryable: true }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

@Global()
@Module({ providers: [LifecycleService, DrainGuard, { provide: APP_GUARD, useExisting: DrainGuard }], exports: [LifecycleService] })
export class LifecycleModule {}
