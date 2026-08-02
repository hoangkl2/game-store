import { Injectable, type LoggerService } from "@nestjs/common";
import { redactStructuredMetadata } from "@game-store/backend-core";
import { RuntimeConfigService } from "../config/environment";
import { RequestContextService } from "../common/request-context";

@Injectable()
export class JsonLogger implements LoggerService {
  constructor(private readonly config: RuntimeConfigService, private readonly contexts: RequestContextService) {}
  log(message: unknown, ...optional: unknown[]): void { this.write("info", message, optional); }
  error(message: unknown, ...optional: unknown[]): void { this.write("error", message, optional); }
  warn(message: unknown, ...optional: unknown[]): void { this.write("warn", message, optional); }
  debug(message: unknown, ...optional: unknown[]): void { this.write("debug", message, optional); }
  verbose(message: unknown, ...optional: unknown[]): void { this.write("trace", message, optional); }
  private write(level: string, message: unknown, optional: unknown[]): void {
    const context = this.contexts.current();
    const metadata = optional.find((value): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value));
    const entry = {
      timestamp: new Date().toISOString(), level, service: "game-store-api", environment: this.config.get("NODE_ENV"), instanceId: this.config.get("INSTANCE_ID"),
      requestId: context?.requestId, traceId: context?.traceId, message: typeof message === "string" ? message.replace(/[\r\n\t]/g, " ").slice(0, 1024) : "Structured event",
      ...(metadata ? redactStructuredMetadata(metadata) : {})
    };
    const serialized = JSON.stringify(entry);
    if (level === "error") process.stderr.write(`${serialized}\n`); else process.stdout.write(`${serialized}\n`);
  }
}
