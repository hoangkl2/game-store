import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { AccessGuard, Principal } from "../auth/access.guard";
import type { AuthPrincipal } from "../auth/auth.types";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { GameActionDto, ReconnectDto } from "./game.dto";
import { GameSessionService } from "./game-session.service";
import { ReconnectService } from "./reconnect.service";

@Controller("games") @UseGuards(AccessGuard)
export class GameController {
  constructor(private readonly games: GameSessionService, private readonly reconnect: ReconnectService) {}
  @Post(":id/actions") @RateLimit("GAME_ACTION_BURST") submit(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: GameActionDto, @Principal() principal: AuthPrincipal) { return this.games.submit(principal.identityId, id, body); }
  @Get(":id/snapshot") @RateLimit("SNAPSHOT") snapshot(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Principal() principal: AuthPrincipal) { return this.games.snapshot(principal.identityId, id); }
  @Get(":id/result") result(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Principal() principal: AuthPrincipal) { return this.games.result(principal.identityId, id); }
  @Post(":id/reconnect-grants") @RateLimit("RECONNECT") issueReconnect(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Principal() principal: AuthPrincipal) { return this.reconnect.issue(principal.identityId, id); }
  @Post("reconnect") @RateLimit("RECONNECT") reconnectSession(@Body() body: ReconnectDto, @Principal() principal: AuthPrincipal) { return this.reconnect.consume(principal.identityId, body.reconnectToken); }
}
