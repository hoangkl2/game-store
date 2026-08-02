import { Global, Module } from "@nestjs/common";
import { CorrelationMiddleware, RequestContextService } from "./request-context";

@Global()
@Module({ providers: [RequestContextService, CorrelationMiddleware], exports: [RequestContextService, CorrelationMiddleware] })
export class CommonModule {}
