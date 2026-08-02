import type { GameEngine, GameReplay, GameResult, GameTransition, RandomProvider, SavedGame, ValidationResult } from "@game-store/game-core";
import type { RoyalRaceRandomSnapshot } from "./random";

export const ROYAL_RACE_GAME_TYPE = "ROYAL_RACE" as const;
export const ROYAL_RACE_GAME_VERSION = "1.0.0" as const;
export const ROYAL_RACE_STATE_VERSION = 1 as const;
export const TRACK_LENGTH = 24;
export const HOME_PATH_LENGTH = 4;
export const FINISH_POSITION = TRACK_LENGTH + HOME_PATH_LENGTH;
export const SAFE_CELLS = [0, 6, 12, 18] as const;
export type RaceColor = "CRIMSON" | "AZURE" | "VERDANT" | "GOLD";
export type RacePlayer = { id: string; name: string; kind: "HUMAN" | "BOT"; color: RaceColor };
export type RacePiece = { id: string; playerId: string; number: number; position: number };
export type RoyalRaceState = { gameType: typeof ROYAL_RACE_GAME_TYPE; gameVersion: typeof ROYAL_RACE_GAME_VERSION; stateVersion: typeof ROYAL_RACE_STATE_VERSION; players: RacePlayer[]; pieces: RacePiece[]; currentPlayerIndex: number; phase: "ROLL" | "MOVE" | "FINISHED"; dice?: number; rankings: string[]; turnNumber: number };
export type RoyalRaceConfig = { players: ReadonlyArray<{ id: string; name: string; kind?: "HUMAN" | "BOT" }>; piecesPerPlayer?: number };
export type RoyalRaceAction = { type: "ROLL_DICE"; playerId: string } | { type: "MOVE_PIECE"; playerId: string; pieceId: string };
export type RoyalRaceSavedGame = SavedGame<RoyalRaceState, RoyalRaceAction> & {
  configuration: {
    players: RacePlayer[];
    piecesPerPlayer: number;
    botPlayerIds: string[];
    rules: { deployRoll: 6; exactFinish: true; safeCells: readonly number[]; extraTurnOn: readonly ["SIX", "CAPTURE", "FINISH"] };
  };
  randomState?: { game: RoyalRaceRandomSnapshot; bot: RoyalRaceRandomSnapshot };
  preferences?: { botSpeed: "FAST" | "NORMAL" | "RELAXED" };
};
export type RoyalRaceEvent =
  | { type: "DICE_ROLLED"; playerId: string; value: number }
  | { type: "NO_LEGAL_MOVE"; playerId: string }
  | { type: "PIECE_DEPLOYED"; playerId: string; pieceId: string; destinationCellId: string }
  | { type: "PIECE_MOVED"; playerId: string; pieceId: string; fromCellId: string; toCellId: string; pathCellIds: string[] }
  | { type: "PIECE_CAPTURED"; attackerPieceId: string; capturedPieceId: string; capturedPlayerId: string }
  | { type: "PIECE_ENTERED_SAFE_ZONE"; pieceId: string; cellId: string }
  | { type: "PIECE_ENTERED_HOME_PATH"; pieceId: string }
  | { type: "PIECE_FINISHED"; playerId: string; pieceId: string }
  | { type: "EXTRA_TURN_GRANTED"; playerId: string; reason: "SIX" | "CAPTURE" | "FINISH" }
  | { type: "TURN_CHANGED"; previousPlayerId: string; currentPlayerId: string }
  | { type: "PLAYER_FINISHED"; playerId: string; rankPosition: number }
  | { type: "GAME_FINISHED"; rankings: string[] };

const COLORS: RaceColor[] = ["CRIMSON", "AZURE", "VERDANT", "GOLD"];
const startOffset = (state: RoyalRaceState, playerId: string) => state.players.findIndex((player) => player.id === playerId) * 6;
const globalCell = (state: RoyalRaceState, piece: RacePiece) => piece.position >= 0 && piece.position < TRACK_LENGTH ? (startOffset(state, piece.playerId) + piece.position) % TRACK_LENGTH : undefined;
const nextPlayerIndex = (state: RoyalRaceState, rankings = state.rankings) => {
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = (state.currentPlayerIndex + offset) % state.players.length;
    if (!rankings.includes(state.players[candidate]!.id)) return candidate;
  }
  return state.currentPlayerIndex;
};
const currentPlayer = (state: RoyalRaceState) => state.players[state.currentPlayerIndex]!;
export const isSafeCell = (cell: number) => SAFE_CELLS.includes(cell as (typeof SAFE_CELLS)[number]);

export class RoyalRaceEngine implements GameEngine<RoyalRaceState, RoyalRaceAction, RoyalRaceEvent, RoyalRaceConfig> {
  constructor(private readonly random: RandomProvider) {}

  createInitialState(config: RoyalRaceConfig): RoyalRaceState {
    if (config.players.length < 2 || config.players.length > 4) throw new Error("Royal Race requires 2 to 4 players");
    if (config.players.some((player) => !player.id.trim() || !player.name.trim()) || new Set(config.players.map((player) => player.id)).size !== config.players.length) throw new Error("Royal Race players require unique non-empty ids and names");
    const piecesPerPlayer = config.piecesPerPlayer ?? 4;
    if (piecesPerPlayer < 1 || piecesPerPlayer > 4) throw new Error("piecesPerPlayer must be between 1 and 4");
    const players = config.players.map((player, index) => ({ ...player, kind: player.kind ?? "HUMAN" as const, color: COLORS[index]! }));
    return { gameType: ROYAL_RACE_GAME_TYPE, gameVersion: ROYAL_RACE_GAME_VERSION, stateVersion: ROYAL_RACE_STATE_VERSION, players, pieces: players.flatMap((player) => Array.from({ length: piecesPerPlayer }, (_, number) => ({ id: `${player.id}-${number + 1}`, playerId: player.id, number: number + 1, position: -1 }))), currentPlayerIndex: 0, phase: "ROLL", rankings: [], turnNumber: 1 };
  }

  getLegalPieceIds(state: RoyalRaceState, playerId: string): string[] {
    if (state.phase !== "MOVE" || state.dice === undefined || currentPlayer(state).id !== playerId) return [];
    const dice = state.dice;
    return state.pieces.filter((piece) => piece.playerId === playerId && piece.position !== FINISH_POSITION && ((piece.position === -1 && dice === 6) || (piece.position >= 0 && piece.position + dice <= FINISH_POSITION))).map((piece) => piece.id);
  }

  validateAction(state: RoyalRaceState, action: RoyalRaceAction): ValidationResult {
    if (state.phase === "FINISHED") return { valid: false, code: "GAME_OVER", message: "The race is finished" };
    if (currentPlayer(state).id !== action.playerId) return { valid: false, code: "NOT_YOUR_TURN", message: "It is not this player's turn" };
    if (state.rankings.includes(action.playerId)) return { valid: false, code: "PLAYER_FINISHED", message: "This player has already finished" };
    if (action.type === "ROLL_DICE") return state.phase === "ROLL" ? { valid: true } : { valid: false, code: "ALREADY_ROLLED", message: "Choose a legal token for this roll" };
    return this.getLegalPieceIds(state, action.playerId).includes(action.pieceId) ? { valid: true } : { valid: false, code: "ILLEGAL_MOVE", message: "This token cannot move with the current roll" };
  }

  reduce(state: RoyalRaceState, action: RoyalRaceAction): GameTransition<RoyalRaceState, RoyalRaceEvent> {
    const validation = this.validateAction(state, action);
    if (!validation.valid) throw new Error(`${validation.code}: ${validation.message}`);
    if (action.type === "ROLL_DICE") {
      const dice = this.random.int(1, 6);
      const rolled = { ...state, phase: "MOVE" as const, dice };
      const events: RoyalRaceEvent[] = [{ type: "DICE_ROLLED", playerId: action.playerId, value: dice }];
      if (this.getLegalPieceIds(rolled, action.playerId).length > 0) return { state: rolled, events };
      const nextIndex = nextPlayerIndex(state);
      events.push({ type: "NO_LEGAL_MOVE", playerId: action.playerId }, { type: "TURN_CHANGED", previousPlayerId: action.playerId, currentPlayerId: state.players[nextIndex]!.id });
      return { state: { ...state, currentPlayerIndex: nextIndex, phase: "ROLL", turnNumber: state.turnNumber + 1 }, events };
    }
    const moving = state.pieces.find((piece) => piece.id === action.pieceId)!;
    const from = moving.position;
    const to = from === -1 ? 0 : from + state.dice!;
    let pieces = state.pieces.map((piece) => piece.id === moving.id ? { ...piece, position: to } : { ...piece });
    const destinationPiece = { ...moving, position: to };
    const destinationGlobal = globalCell(state, destinationPiece);
    const pathCellIds = from === -1 ? [`track-${destinationGlobal}`] : Array.from({ length: to - from }, (_, index) => this.getCellId(state, { ...moving, position: from + index + 1 }));
    const events: RoyalRaceEvent[] = from === -1
      ? [{ type: "PIECE_DEPLOYED", playerId: action.playerId, pieceId: moving.id, destinationCellId: this.getCellId(state, destinationPiece) }]
      : [{ type: "PIECE_MOVED", playerId: action.playerId, pieceId: moving.id, fromCellId: this.getCellId(state, moving), toCellId: this.getCellId(state, destinationPiece), pathCellIds }];
    let captured = false;
    if (destinationGlobal !== undefined && !isSafeCell(destinationGlobal)) {
      pieces = pieces.map((piece) => {
        if (piece.playerId !== action.playerId && globalCell(state, piece) === destinationGlobal) { captured = true; events.push({ type: "PIECE_CAPTURED", attackerPieceId: moving.id, capturedPieceId: piece.id, capturedPlayerId: piece.playerId }); return { ...piece, position: -1 }; }
        return piece;
      });
    }
    if (destinationGlobal !== undefined && isSafeCell(destinationGlobal)) events.push({ type: "PIECE_ENTERED_SAFE_ZONE", pieceId: moving.id, cellId: `track-${destinationGlobal}` });
    if (from < TRACK_LENGTH && to >= TRACK_LENGTH && to < FINISH_POSITION) events.push({ type: "PIECE_ENTERED_HOME_PATH", pieceId: moving.id });
    const rankings = [...state.rankings];
    let finish = false;
    let playerCompleted = false;
    if (to === FINISH_POSITION) {
      finish = true; events.push({ type: "PIECE_FINISHED", playerId: action.playerId, pieceId: moving.id });
      if (pieces.filter((piece) => piece.playerId === action.playerId).every((piece) => piece.position === FINISH_POSITION) && !rankings.includes(action.playerId)) { playerCompleted = true; rankings.push(action.playerId); events.push({ type: "PLAYER_FINISHED", playerId: action.playerId, rankPosition: rankings.length }); }
    }
    if (rankings.length === state.players.length - 1) {
      const last = state.players.find((player) => !rankings.includes(player.id))!.id; const finalRankings = [...rankings, last]; events.push({ type: "GAME_FINISHED", rankings: finalRankings });
      return { state: { ...state, pieces, rankings: finalRankings, dice: undefined, phase: "FINISHED", turnNumber: state.turnNumber + 1 }, events };
    }
    const extraReason = playerCompleted ? undefined : state.dice === 6 ? "SIX" : captured ? "CAPTURE" : finish ? "FINISH" : undefined;
    if (extraReason) { events.push({ type: "EXTRA_TURN_GRANTED", playerId: action.playerId, reason: extraReason }); return { state: { ...state, pieces, rankings, dice: undefined, phase: "ROLL", turnNumber: state.turnNumber + 1 }, events }; }
    const nextIndex = nextPlayerIndex(state, rankings); events.push({ type: "TURN_CHANGED", previousPlayerId: action.playerId, currentPlayerId: state.players[nextIndex]!.id });
    return { state: { ...state, pieces, rankings, dice: undefined, phase: "ROLL", currentPlayerIndex: nextIndex, turnNumber: state.turnNumber + 1 }, events };
  }

  getGlobalTrackCell(state: RoyalRaceState, piece: RacePiece): number | undefined { return globalCell(state, piece); }
  getCellId(state: RoyalRaceState, piece: RacePiece): string { if (piece.position === -1) return `home-${piece.playerId}`; if (piece.position === FINISH_POSITION) return `finish-${piece.playerId}`; if (piece.position >= TRACK_LENGTH) return `home-path-${piece.playerId}-${piece.position - TRACK_LENGTH + 1}`; return `track-${globalCell(state, piece)}`; }
  getValidActions(state: RoyalRaceState, playerId: string): RoyalRaceAction[] { if (currentPlayer(state).id !== playerId || state.phase === "FINISHED") return []; return state.phase === "ROLL" ? [{ type: "ROLL_DICE", playerId }] : this.getLegalPieceIds(state, playerId).map((pieceId) => ({ type: "MOVE_PIECE", playerId, pieceId })); }
  checkGameOver(state: RoyalRaceState): GameResult | null { return state.phase === "FINISHED" ? { outcome: "WIN", winnerId: state.rankings[0], rankings: state.rankings } : null; }
  serialize(state: RoyalRaceState): string { return JSON.stringify(state); }
  deserialize(data: string): RoyalRaceState { const value: unknown = JSON.parse(data); if (!isRoyalRaceState(value)) throw new Error("Invalid Royal Race state"); return value; }
}

const isRoyalRaceState = (value: unknown): value is RoyalRaceState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<RoyalRaceState>;
  if (state.gameType !== ROYAL_RACE_GAME_TYPE || state.gameVersion !== ROYAL_RACE_GAME_VERSION || state.stateVersion !== ROYAL_RACE_STATE_VERSION) return false;
  if (!Array.isArray(state.players) || state.players.length < 2 || state.players.length > 4) return false;
  if (!state.players.every((player) => player && typeof player.id === "string" && player.id.length > 0 && typeof player.name === "string" && player.name.length > 0 && (player.kind === "HUMAN" || player.kind === "BOT") && COLORS.includes(player.color))) return false;
  const playerIds = state.players.map((player) => player.id);
  if (new Set(playerIds).size !== playerIds.length || !Array.isArray(state.pieces)) return false;
  if (!state.pieces.every((piece) => piece && typeof piece.id === "string" && playerIds.includes(piece.playerId) && Number.isInteger(piece.number) && piece.number >= 1 && piece.number <= 4 && Number.isInteger(piece.position) && piece.position >= -1 && piece.position <= FINISH_POSITION)) return false;
  if (new Set(state.pieces.map((piece) => piece.id)).size !== state.pieces.length) return false;
  const pieceCounts = playerIds.map((playerId) => state.pieces!.filter((piece) => piece.playerId === playerId).length);
  if (pieceCounts.some((count) => count < 1 || count > 4 || count !== pieceCounts[0])) return false;
  if (!Number.isInteger(state.currentPlayerIndex) || state.currentPlayerIndex! < 0 || state.currentPlayerIndex! >= state.players.length) return false;
  if (state.phase !== "ROLL" && state.phase !== "MOVE" && state.phase !== "FINISHED") return false;
  if (state.phase === "MOVE" ? !Number.isInteger(state.dice) || state.dice! < 1 || state.dice! > 6 : state.dice !== undefined) return false;
  if (!Array.isArray(state.rankings) || new Set(state.rankings).size !== state.rankings.length || !state.rankings.every((id) => playerIds.includes(id))) return false;
  if (state.phase === "FINISHED" ? state.rankings.length !== state.players.length : state.rankings.includes(state.players[state.currentPlayerIndex!]!.id)) return false;
  return Number.isInteger(state.turnNumber) && state.turnNumber! >= 1;
};
export const replayRoyalRace = (engine: RoyalRaceEngine, replay: GameReplay<RoyalRaceState, RoyalRaceAction>) => replay.actions.reduce((state, entry) => engine.reduce(state, entry.action).state, replay.initialState);
export const createRoyalRaceSavedGame = (
  engine: RoyalRaceEngine,
  id: string,
  state: RoyalRaceState,
  actionHistory: SavedGame<RoyalRaceState, RoyalRaceAction>["actionHistory"],
  now = new Date().toISOString(),
  extras: Pick<RoyalRaceSavedGame, "randomState" | "preferences"> = {},
): RoyalRaceSavedGame => ({
  id,
  gameType: ROYAL_RACE_GAME_TYPE,
  gameVersion: ROYAL_RACE_GAME_VERSION,
  stateVersion: ROYAL_RACE_STATE_VERSION,
  serializedState: engine.serialize(state),
  actionHistory,
  createdAt: now,
  updatedAt: now,
  configuration: {
    players: state.players.map((player) => ({ ...player })),
    piecesPerPlayer: state.pieces.filter((piece) => piece.playerId === state.players[0]!.id).length,
    botPlayerIds: state.players.filter((player) => player.kind === "BOT").map((player) => player.id),
    rules: { deployRoll: 6, exactFinish: true, safeCells: [...SAFE_CELLS], extraTurnOn: ["SIX", "CAPTURE", "FINISH"] },
  },
  ...extras,
});
