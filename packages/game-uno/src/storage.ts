import type { ActionHistory, SavedGame } from "@game-store/game-core";
import { UNO_STATE_VERSION, UnoEngine, type UnoAction, type UnoGameState } from "./engine";

export type UnoSavedGame = SavedGame<UnoGameState, UnoAction>;
export interface UnoSaveStore { save(game: UnoSavedGame): Promise<void>; get(id: string): Promise<UnoSavedGame | undefined>; delete(id: string): Promise<void>; list(): Promise<UnoSavedGame[]>; }

export class IndexedDbUnoSaveStore implements UnoSaveStore {
  constructor(private readonly databaseName = "game-store", private readonly storeName = "uno-saved-games") {}
  private open(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(this.databaseName, 1); request.onupgradeneeded = () => request.result.createObjectStore(this.storeName, { keyPath: "id" }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async save(game: UnoSavedGame): Promise<void> { const db = await this.open(); await this.request(db.transaction(this.storeName, "readwrite").objectStore(this.storeName).put(game)); db.close(); }
  async get(id: string): Promise<UnoSavedGame | undefined> { const db = await this.open(); const result = await this.request<UnoSavedGame | undefined>(db.transaction(this.storeName).objectStore(this.storeName).get(id)); db.close(); return result; }
  async delete(id: string): Promise<void> { const db = await this.open(); await this.request(db.transaction(this.storeName, "readwrite").objectStore(this.storeName).delete(id)); db.close(); }
  async list(): Promise<UnoSavedGame[]> { const db = await this.open(); const result = await this.request<UnoSavedGame[]>(db.transaction(this.storeName).objectStore(this.storeName).getAll()); db.close(); return result; }
  private request<T = unknown>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
}

export function createEmptyActionHistory(): ActionHistory<UnoAction> { return []; }

export function migrateUnoState(state: UnoGameState, fromVersion: number): UnoGameState {
  if (fromVersion === UNO_STATE_VERSION) return state;
  throw new Error(`Unsupported UNO state version: ${fromVersion}`);
}

export function deserializeUnoSavedGame(engine: UnoEngine, saved: UnoSavedGame): UnoGameState {
  if (saved.gameType !== "UNO") throw new Error("Saved game is not UNO");
  return migrateUnoState(engine.deserialize(saved.serializedState), saved.stateVersion);
}
