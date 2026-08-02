import { SetMetadata } from "@nestjs/common";
import type { RateLimitScope } from "@game-store/backend-core";

export const RATE_LIMIT_SCOPE = "game-store:rate-limit-scope";
export const RateLimit = (scope: RateLimitScope) => SetMetadata(RATE_LIMIT_SCOPE, scope);
