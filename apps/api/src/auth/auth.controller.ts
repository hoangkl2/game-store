import { Body, Controller, Headers, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { RuntimeConfigService } from "../config/environment";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AccessGuard, Principal } from "./access.guard";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./auth.dto";
import type { AuthPrincipal } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: RuntimeConfigService) {}
  private cookieOptions(httpOnly: boolean): CookieOptions { return { httpOnly, secure: this.config.get("COOKIE_SECURE"), sameSite: this.config.get("COOKIE_SAME_SITE"), path: "/", maxAge: this.config.get("REFRESH_TOKEN_TTL_SECONDS") * 1000 }; }
  private setSession(response: Response, result: { refreshToken: string; csrfToken: string }): void { response.cookie(this.config.get("REFRESH_COOKIE_NAME"), result.refreshToken, this.cookieOptions(true)); response.cookie(this.config.get("CSRF_COOKIE_NAME"), result.csrfToken, this.cookieOptions(false)); }
  private clearSession(response: Response): void { response.clearCookie(this.config.get("REFRESH_COOKIE_NAME"), this.cookieOptions(true)); response.clearCookie(this.config.get("CSRF_COOKIE_NAME"), this.cookieOptions(false)); }
  private verifyOrigin(request: Request): void { const origin = request.header("origin"); if (!origin || !this.config.get("CORS_ORIGINS").includes(origin) || !request.is("application/json")) throw new UnauthorizedException("Request origin or content type rejected"); }
  private verifyCsrf(request: Request): string {
    this.verifyOrigin(request);
    const header = request.header("x-csrf-token"); const cookie = request.cookies?.[this.config.get("CSRF_COOKIE_NAME")] as string | undefined; const origin = request.header("origin");
    if (!header || !cookie || header !== cookie || !origin || !this.config.get("CORS_ORIGINS").includes(origin)) throw new UnauthorizedException("CSRF validation failed");
    return header;
  }
  @Post("register") @RateLimit("REGISTRATION") async register(@Req() request: Request, @Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) { this.verifyOrigin(request); const result = await this.auth.register({ ...body, deviceLabel: "Browser" }); this.setSession(response, result); return { accessToken: result.accessToken, user: result.user }; }
  @Post("login") @RateLimit("LOGIN") async login(@Req() request: Request, @Body() body: LoginDto, @Res({ passthrough: true }) response: Response) { this.verifyOrigin(request); const result = await this.auth.login(body); this.setSession(response, result); return { accessToken: result.accessToken, user: result.user }; }
  @Post("refresh") @RateLimit("LOGIN") async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) { const csrf = this.verifyCsrf(request); const refreshToken = request.cookies?.[this.config.get("REFRESH_COOKIE_NAME")] as string | undefined; if (!refreshToken) throw new UnauthorizedException("Refresh session expired or revoked"); const result = await this.auth.refresh(refreshToken, csrf); this.setSession(response, result); return { accessToken: result.accessToken }; }
  @Post("logout") @UseGuards(AccessGuard) async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Principal() principal: AuthPrincipal) { this.verifyCsrf(request); await this.auth.logoutCurrent(principal.userId, principal.sessionId); this.clearSession(response); return { success: true }; }
  @Post("logout-all") @UseGuards(AccessGuard) async logoutAll(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Principal() principal: AuthPrincipal, @Headers("origin") _origin?: string) { this.verifyCsrf(request); await this.auth.logoutAll(principal.userId); this.clearSession(response); return { success: true }; }
}
