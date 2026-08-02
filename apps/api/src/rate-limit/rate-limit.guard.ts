import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RATE_LIMIT_POLICIES, type RateLimitScope } from "@game-store/backend-core";
import { createHmac } from "node:crypto";
import type { AuthenticatedRequest } from "../auth/access.guard";
import { RuntimeConfigService } from "../config/environment";
import { RedisService } from "../redis/redis.service";
import { RATE_LIMIT_SCOPE } from "./rate-limit.decorator";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly redis: RedisService, private readonly config: RuntimeConfigService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.getAllAndOverride<RateLimitScope>(RATE_LIMIT_SCOPE, [context.getHandler(), context.getClass()]);
    if (!scope) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>(); const response = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>(); const policy = RATE_LIMIT_POLICIES[scope];
    const networkRisk = createHmac("sha256", this.config.get("ACCESS_TOKEN_SECRET")).update(request.ip ?? "unknown").digest("base64url").slice(0, 24);
    const identity = request.principal?.identityId ?? request.body?.email?.toString().toLowerCase().slice(0, 320) ?? "anonymous";
    const session = request.principal?.sessionId ?? "none";
    const keyedHash = (material: string) => createHmac("sha256", this.config.get("ACCESS_TOKEN_SECRET")).update(material).digest("base64url");
    const keys: string[] = [];
    if (policy.keyParts.includes("IDENTITY") || policy.keyParts.includes("SESSION")) keys.push(`ratelimit:${scope}:identity-session:${keyedHash(`${identity}:${session}`)}`);
    if (policy.keyParts.includes("NETWORK_RISK")) keys.push(`ratelimit:${scope}:network:${networkRisk}`);
    try {
      const counts = await Promise.all(keys.map((key) => this.redis.incrementWindow(key, policy.windowSeconds)));
      if (counts.some((count) => count > policy.limit)) { response.setHeader("Retry-After", String(policy.windowSeconds)); throw new HttpException({ code: "RATE_LIMITED", retryAfterSeconds: policy.windowSeconds }, HttpStatus.TOO_MANY_REQUESTS); }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (this.config.get("REDIS_REQUIRED")) throw new HttpException({ code: "COORDINATION_UNAVAILABLE" }, HttpStatus.SERVICE_UNAVAILABLE);
      return true;
    }
  }
}
