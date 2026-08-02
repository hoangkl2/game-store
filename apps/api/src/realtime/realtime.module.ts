import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GameModule } from "../game/game.module";
import { RoomModule } from "../rooms/room.module";
import { RealtimeGateway } from "./realtime.gateway";

@Module({ imports: [AuthModule, GameModule, RoomModule], providers: [RealtimeGateway] })
export class RealtimeModule {}
