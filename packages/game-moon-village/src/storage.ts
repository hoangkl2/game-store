import { MOON_VILLAGE_GAME_VERSION, MOON_VILLAGE_PROJECTION_VERSION, MOON_VILLAGE_STATE_VERSION } from "./engine";
import type { MoonVillageSessionSnapshot } from "./session";

export const MOON_VILLAGE_SAVE_VERSION = 1;
export type MoonVillageSavedGame = { id: string; gameType: "MOON_VILLAGE"; gameVersion: string; stateVersion: number; projectionVersion: number; saveVersion: number; createdAt: string; updatedAt: string; snapshot: MoonVillageSessionSnapshot; preferences: { botDifficulty: string; botSpeed: string } };

export const createMoonVillageSavedGame = (id: string, snapshot: MoonVillageSessionSnapshot, preferences: MoonVillageSavedGame["preferences"], createdAt = new Date().toISOString()): MoonVillageSavedGame => ({ id, gameType: "MOON_VILLAGE", gameVersion: MOON_VILLAGE_GAME_VERSION, stateVersion: MOON_VILLAGE_STATE_VERSION, projectionVersion: MOON_VILLAGE_PROJECTION_VERSION, saveVersion: MOON_VILLAGE_SAVE_VERSION, createdAt, updatedAt: new Date().toISOString(), snapshot, preferences });

export const validateMoonVillageSavedGame = (value: unknown): MoonVillageSavedGame => {
  if (!value || typeof value !== "object") throw new Error("Invalid Moon Village save");
  const save = value as Partial<MoonVillageSavedGame>;
  if (save.gameType !== "MOON_VILLAGE" || save.gameVersion !== MOON_VILLAGE_GAME_VERSION || save.stateVersion !== MOON_VILLAGE_STATE_VERSION || save.projectionVersion !== MOON_VILLAGE_PROJECTION_VERSION || save.saveVersion !== MOON_VILLAGE_SAVE_VERSION || typeof save.id !== "string" || typeof save.createdAt !== "string" || typeof save.updatedAt !== "string" || !save.snapshot || typeof save.snapshot.serializedState !== "string" || !Array.isArray(save.snapshot.actionHistory) || !save.snapshot.botMemories || !save.snapshot.randomState || !save.preferences) throw new Error("Unsupported or corrupt Moon Village save");
  return save as MoonVillageSavedGame;
};

export class IndexedDbMoonVillageSaveStore {
  constructor(private readonly databaseName = "game-store-moon-village", private readonly storeName = "moon-village-saves") {}
  private open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(this.databaseName, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(this.storeName)) request.result.createObjectStore(this.storeName, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  private request<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async save(game: MoonVillageSavedGame) { const database = await this.open(); try { await this.request(database.transaction(this.storeName, "readwrite").objectStore(this.storeName).put(game)); } finally { database.close(); } }
  async get(id: string) { const database = await this.open(); try { const result = await this.request<unknown>(database.transaction(this.storeName).objectStore(this.storeName).get(id)); return result === undefined ? undefined : validateMoonVillageSavedGame(result); } finally { database.close(); } }
}
