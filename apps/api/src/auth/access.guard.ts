import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import { AuthTokenService } from "./auth-token.service";
import type { AuthPrincipal } from "./auth.types";

export interface AuthenticatedRequest extends Request { principal?: AuthPrincipal }

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly tokens: AuthTokenService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new UnauthorizedException("Authentication required");
    request.principal = await this.tokens.verify(authorization.slice(7));
    return true;
  }
}

export const Principal = createParamDecorator((_data: unknown, context: ExecutionContext): AuthPrincipal => {
  const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
  if (!principal) throw new UnauthorizedException("Authentication required");
  return principal;
});
