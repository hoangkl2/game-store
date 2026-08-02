import { describe, expect, it, vi } from "vitest";
import { SeededRandomProvider } from "@game-store/game-core";
import { UnoEngine } from "@game-store/game-uno";
import type { AuditService } from "../audit/audit.service";
import type { RuntimeConfigService } from "../config/environment";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthoritativeStateService } from "./authoritative-state.service";
import { StateCipherService } from "./state-cipher.service";

const seed = 27;
const cipher = () => new StateCipherService({ get: () => "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } as unknown as RuntimeConfigService);

describe("authoritative snapshot recovery", () => {
  it("quarantines a corrupt latest snapshot and replays the durable command journal", async () => {
    const stateCipher = cipher(); const engine = new UnoEngine(new SeededRandomProvider(seed));
    const initial = engine.createInitialState({ players: [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }] });
    const action = engine.getValidActions(initial, "p1")[0]!; const expected = new UnoEngine(new SeededRandomProvider(seed)).reduce(initial, action).state;
    const storedInitial = stateCipher.encrypt(engine.serialize(initial)); const storedAction = stateCipher.encrypt(JSON.stringify(action));
    const updateMany = vi.fn().mockResolvedValue({ count: 1 }); const record = vi.fn().mockResolvedValue(undefined);
    const prisma = { gameCommand: { findMany: vi.fn().mockResolvedValue([{ stateVersion: 2, encryptedPayload: storedAction.encryptedPayload, checksum: storedAction.checksum }]) }, gameSnapshot: { updateMany } } as unknown as PrismaService;
    const recovery = new AuthoritativeStateService(prisma, stateCipher, { record } as unknown as AuditService);
    const recovered = await recovery.loadColorClash("session", seed, 2, [
      { id: "corrupt-latest", stateVersion: 2, encryptedPayload: "corrupt", checksum: "bad" },
      { id: "valid-prior", stateVersion: 1, ...storedInitial }
    ]);
    expect(recovered).toEqual(expected); expect(updateMany).toHaveBeenCalledOnce(); expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: "game.snapshot.quarantine", resourceId: "corrupt-latest" }));
  });

  it("fails closed when no checksum-valid contiguous recovery chain exists", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 }); const stateCipher = cipher();
    const recovery = new AuthoritativeStateService({ gameCommand: { findMany: vi.fn().mockResolvedValue([]) }, gameSnapshot: { updateMany } } as unknown as PrismaService, stateCipher, { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService);
    await expect(recovery.loadColorClash("session", seed, 3, [{ id: "only", stateVersion: 2, ...stateCipher.encrypt("not-engine-state") }])).rejects.toMatchObject({ response: { code: "AUTHORITATIVE_STATE_UNRECOVERABLE" } });
    expect(updateMany).toHaveBeenCalledOnce();
  });
});
