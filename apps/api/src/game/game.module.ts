import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { GameController } from "./game.controller";
import { GameProjectionService } from "./game-projection.service";
import { GameSessionService } from "./game-session.service";
import { OutboxService } from "./outbox.service";
import { PrismaIdempotencyRepository } from "./prisma-idempotency.repository";
import { ReconnectService } from "./reconnect.service";
import { StateCipherService } from "./state-cipher.service";
import { AuthoritativeStateService } from "./authoritative-state.service";
import { AuthModule } from "../auth/auth.module";

@Module({ imports: [AuthModule, EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 })], controllers: [GameController], providers: [StateCipherService, AuthoritativeStateService, GameProjectionService, PrismaIdempotencyRepository, GameSessionService, ReconnectService, OutboxService], exports: [StateCipherService, GameProjectionService, GameSessionService, ReconnectService] })
export class GameModule {}
