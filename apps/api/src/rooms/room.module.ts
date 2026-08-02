import { Module } from "@nestjs/common";
import { GameModule } from "../game/game.module";
import { AuthModule } from "../auth/auth.module";
import { RoomController } from "./room.controller";
import { RoomService } from "./room.service";

@Module({ imports: [AuthModule, GameModule], controllers: [RoomController], providers: [RoomService], exports: [RoomService] })
export class RoomModule {}
