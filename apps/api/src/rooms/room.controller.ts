import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AccessGuard, Principal } from "../auth/access.guard";
import type { AuthPrincipal } from "../auth/auth.types";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { CreateRoomDto, JoinRoomDto, ReadyRoomDto, StartRoomDto } from "./room.dto";
import { RoomService } from "./room.service";

@Controller("rooms") @UseGuards(AccessGuard)
export class RoomController {
  constructor(private readonly rooms: RoomService) {}
  @Post() @RateLimit("ROOM_CREATE") create(@Body() body: CreateRoomDto, @Principal() principal: AuthPrincipal) { return this.rooms.create(principal.userId, body.capacity); }
  @Get(":code") get(@Param("code") code: string, @Principal() principal: AuthPrincipal) { return this.rooms.getByCode(code, principal.identityId); }
  @Post(":code/join") @RateLimit("ROOM_JOIN") join(@Param("code") code: string, @Body() body: JoinRoomDto, @Principal() principal: AuthPrincipal) { return this.rooms.join(code, principal.userId, body.displayName); }
  @Post(":code/ready") ready(@Param("code") code: string, @Body() body: ReadyRoomDto, @Principal() principal: AuthPrincipal) { return this.rooms.setReady(code, principal.userId, body.ready, body.expectedRoomVersion); }
  @Post(":code/start") start(@Param("code") code: string, @Body() body: StartRoomDto, @Principal() principal: AuthPrincipal) { return this.rooms.start(code, principal.userId, body.expectedRoomVersion); }
}
