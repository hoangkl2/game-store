import { ROYAL_RACE_STATE_VERSION, RoyalRaceEngine, type RoyalRaceSavedGame } from "./engine";

export type { RoyalRaceSavedGame } from "./engine";

export class IndexedDbRoyalRaceSaveStore {
  constructor(private databaseName = "game-store-royal-race", private storeName = "royal-race-saves") {}
  private open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(this.databaseName, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(this.storeName)) request.result.createObjectStore(this.storeName, { keyPath: "id" }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  private request<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async save(game: RoyalRaceSavedGame) { const db = await this.open(); await this.request(db.transaction(this.storeName, "readwrite").objectStore(this.storeName).put(game)); db.close(); }
  async get(id: string) { const db = await this.open(); const value = await this.request<RoyalRaceSavedGame | undefined>(db.transaction(this.storeName).objectStore(this.storeName).get(id)); db.close(); return value; }
}

export const deserializeRoyalRaceSavedGame = (engine: RoyalRaceEngine, saved: RoyalRaceSavedGame) => { if (saved.gameType !== "ROYAL_RACE" || saved.stateVersion !== ROYAL_RACE_STATE_VERSION) throw new Error("Unsupported Royal Race save"); return engine.deserialize(saved.serializedState); };
