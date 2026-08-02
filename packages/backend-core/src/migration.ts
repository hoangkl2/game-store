import { createHash } from "node:crypto";

export interface PersistedSnapshotV1 {
  schemaVersion: 1;
  gameType: string;
  gameVersion: string;
  stateVersion: number;
  state: string;
  createdAt: string;
}

export interface PersistedSnapshotV2 {
  schemaVersion: 2;
  gameType: string;
  gameVersion: string;
  stateVersion: number;
  projectionVersion: number;
  serializedState: string;
  checksum: string;
  createdAt: string;
}

const checksum = (value: string): string => createHash("sha256").update(value, "utf8").digest("base64url");

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }

export function validatePersistedSnapshotV2(value: unknown): PersistedSnapshotV2 {
  if (!isRecord(value) || value.schemaVersion !== 2 || typeof value.gameType !== "string" || !value.gameType || typeof value.gameVersion !== "string" || !value.gameVersion || !Number.isInteger(value.stateVersion) || (value.stateVersion as number) < 0 || !Number.isInteger(value.projectionVersion) || (value.projectionVersion as number) < 1 || typeof value.serializedState !== "string" || !value.serializedState || typeof value.checksum !== "string" || value.checksum !== checksum(value.serializedState) || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) throw new Error("Unsupported or corrupt persisted snapshot");
  return structuredClone(value) as unknown as PersistedSnapshotV2;
}

export function migratePersistedSnapshot(value: unknown): PersistedSnapshotV2 {
  if (!isRecord(value)) throw new Error("Unsupported or corrupt persisted snapshot");
  if (value.schemaVersion === 2) return validatePersistedSnapshotV2(value);
  if (value.schemaVersion !== 1 || typeof value.gameType !== "string" || !value.gameType || typeof value.gameVersion !== "string" || !value.gameVersion || !Number.isInteger(value.stateVersion) || (value.stateVersion as number) < 0 || typeof value.state !== "string" || !value.state || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) throw new Error("Unsupported or corrupt persisted snapshot");
  return validatePersistedSnapshotV2({ schemaVersion: 2, gameType: value.gameType, gameVersion: value.gameVersion, stateVersion: value.stateVersion, projectionVersion: 1, serializedState: value.state, checksum: checksum(value.state), createdAt: value.createdAt });
}
