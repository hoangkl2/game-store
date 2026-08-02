import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { SeededRandomProvider } from "@game-store/game-core";
import { UnoEngine, type UnoGameState } from "@game-store/game-uno";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { isColorClashAction } from "./color-clash-action";
import { StateCipherService } from "./state-cipher.service";

interface StoredSnapshot { id: string; stateVersion: number; encryptedPayload: string; checksum: string }

@Injectable()
export class AuthoritativeStateService {
  constructor(private readonly prisma: PrismaService, private readonly cipher: StateCipherService, private readonly audit: AuditService) {}

  async loadColorClash(gameSessionId: string, randomSeed: number, authoritativeVersion: number, snapshots: StoredSnapshot[]): Promise<UnoGameState> {
    for (const snapshot of snapshots) {
      try {
        let state = new UnoEngine(new SeededRandomProvider(randomSeed)).deserialize(this.cipher.decrypt(snapshot.encryptedPayload, snapshot.checksum));
        if (snapshot.stateVersion > authoritativeVersion) throw new Error("SNAPSHOT_AHEAD_OF_SESSION");
        if (snapshot.stateVersion < authoritativeVersion) {
          const commands = await this.prisma.gameCommand.findMany({ where: { gameSessionId, stateVersion: { gt: snapshot.stateVersion, lte: authoritativeVersion } }, orderBy: { stateVersion: "asc" } });
          if (commands.length !== authoritativeVersion - snapshot.stateVersion) throw new Error("COMMAND_JOURNAL_GAP");
          let expected = snapshot.stateVersion + 1;
          for (const command of commands) {
            if (command.stateVersion !== expected) throw new Error("COMMAND_JOURNAL_GAP");
            const action = JSON.parse(this.cipher.decrypt(command.encryptedPayload, command.checksum)) as unknown;
            if (!isColorClashAction(action)) throw new Error("CORRUPT_COMMAND");
            const replayEngine = new UnoEngine(new SeededRandomProvider(randomSeed));
            if (!replayEngine.validateAction(state, action).valid) throw new Error("INVALID_REPLAY_COMMAND");
            state = replayEngine.reduce(state, action).state;
            expected += 1;
          }
        }
        return state;
      } catch (error) {
        await this.prisma.gameSnapshot.updateMany({ where: { id: snapshot.id, quarantinedAt: null }, data: { quarantinedAt: new Date() } });
        await this.audit.record({ action: "game.snapshot.quarantine", outcome: "FAILURE", resourceType: "game-snapshot", resourceId: snapshot.id, metadata: { errorName: error instanceof Error ? error.message.slice(0, 80) : "unknown" } });
      }
    }
    throw new ServiceUnavailableException({ code: "AUTHORITATIVE_STATE_UNRECOVERABLE" });
  }
}
