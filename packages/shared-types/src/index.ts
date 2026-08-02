export type GameType = "UNO" | "LUDO" | "MONOPOLY" | "WEREWOLF";
export type ApiResponse<T> = { data: T; requestId: string };
