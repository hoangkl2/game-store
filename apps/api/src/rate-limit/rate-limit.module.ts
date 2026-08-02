import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { RateLimitGuard } from "./rate-limit.guard";

@Global()
@Module({ providers: [RateLimitGuard, { provide: APP_GUARD, useExisting: RateLimitGuard }], exports: [RateLimitGuard] })
export class RateLimitModule {}
