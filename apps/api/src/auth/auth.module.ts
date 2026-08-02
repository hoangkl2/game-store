import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AccessGuard } from "./access.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";

@Module({ imports: [JwtModule.register({})], controllers: [AuthController], providers: [AuthService, AuthTokenService, AccessGuard], exports: [AuthService, AuthTokenService, AccessGuard] })
export class AuthModule {}
