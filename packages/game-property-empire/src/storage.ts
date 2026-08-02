import { PROPERTY_EMPIRE_BOARD_VERSION } from "./board";
import { PROPERTY_EMPIRE_STATE_VERSION, PropertyEmpireEngine, type PropertyEmpireSavedGame } from "./engine";

export type { PropertyEmpireSavedGame } from "./engine";

export class IndexedDbPropertyEmpireSaveStore {
  constructor(private readonly databaseName = "game-store-property-empire", private readonly storeName = "property-empire-saves") {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(this.storeName)) request.result.createObjectStore(this.storeName, { keyPath: "id" }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  }

  async save(game: PropertyEmpireSavedGame) { const database = await this.open(); try { await this.request(database.transaction(this.storeName, "readwrite").objectStore(this.storeName).put(game)); } finally { database.close(); } }
  async get(id: string) { const database = await this.open(); try { return await this.request<PropertyEmpireSavedGame | undefined>(database.transaction(this.storeName).objectStore(this.storeName).get(id)); } finally { database.close(); } }
}

export const deserializePropertyEmpireSavedGame = (engine: PropertyEmpireEngine, saved: PropertyEmpireSavedGame) => {
  if (saved.gameType !== "PROPERTY_EMPIRE" || saved.stateVersion !== PROPERTY_EMPIRE_STATE_VERSION || saved.boardVersion !== PROPERTY_EMPIRE_BOARD_VERSION) throw new Error("Unsupported Property Empire save");
  return engine.deserialize(saved.serializedState);
};
