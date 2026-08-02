import type { UnoAction, UnoEngine, UnoGameState } from "./engine";

/** A dependency-free StateCreator-shaped adapter for Zustand. */
export type UnoStoreState = { uno: UnoGameState | null; lastError?: string; dispatch(action: UnoAction): void; reset(state: UnoGameState): void };
export type UnoStateCreator = (set: (update: Partial<UnoStoreState>) => void, get: () => UnoStoreState) => UnoStoreState;

export function createUnoStoreSlice(engine: UnoEngine, initialState: UnoGameState | null): UnoStateCreator {
  return (set, get) => ({
    uno: initialState,
    dispatch(action) {
      const current = get().uno;
      if (!current) return;
      try { set({ uno: engine.reduce(current, action).state, lastError: undefined }); }
      catch (error) { set({ lastError: error instanceof Error ? error.message : "Unable to apply UNO action" }); }
    },
    reset(state) { set({ uno: state, lastError: undefined }); },
  });
}
