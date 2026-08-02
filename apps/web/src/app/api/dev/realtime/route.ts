import { NextResponse } from "next/server";
import { MockColorClashAuthority, type GameActionCommand, type MockIdentity, type Recipient } from "@game-store/realtime-core";
import type { UnoAction } from "@game-store/game-uno";

const runtime = globalThis as typeof globalThis & { __gameStoreMockRealtime?: MockColorClashAuthority };
const authority = runtime.__gameStoreMockRealtime ??= new MockColorClashAuthority();
type Payload = { op?: string; roomCode?: string; displayName?: string; identity?: MockIdentity; ready?: boolean; expectedRoomVersion?: number; gameSessionId?: string; recipient?: Recipient; command?: GameActionCommand<UnoAction>; spectatorId?: string; playerId?: string };

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0); if (declaredLength > 8192) return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    const raw = await request.text(); if (new TextEncoder().encode(raw).length > 8192) return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 }); const body = JSON.parse(raw) as Payload;
    switch (body.op) {
      case "reset": authority.reset(); return NextResponse.json({ ok: true });
      case "create": return NextResponse.json(authority.createRoom(required(body.identity), body.displayName ?? "Host"));
      case "join": return NextResponse.json(authority.joinRoom(text(body.roomCode), required(body.identity), body.displayName ?? "Guest"));
      case "ready": return NextResponse.json(authority.setReady(text(body.roomCode), required(body.identity), Boolean(body.ready), integer(body.expectedRoomVersion)));
      case "start": return NextResponse.json(authority.startGame(text(body.roomCode), required(body.identity), integer(body.expectedRoomVersion)));
      case "room": return NextResponse.json(authority.roomSnapshot(text(body.roomCode)));
      case "snapshot": return NextResponse.json(authority.snapshot(text(body.gameSessionId), body.recipient ?? { type: "SPECTATOR" }));
      case "action": return NextResponse.json(authority.submit(required(body.identity), required(body.command)));
      case "disconnect": return NextResponse.json(authority.disconnect(text(body.roomCode), required(body.identity)));
      case "reconnect": return NextResponse.json(authority.reconnect(text(body.roomCode), required(body.identity)));
      case "spectate": return NextResponse.json(authority.joinSpectator(text(body.roomCode), text(body.spectatorId)));
      case "replace-bot": return NextResponse.json(authority.replaceWithBot(text(body.roomCode), required(body.identity), text(body.playerId), integer(body.expectedRoomVersion)));
      default: return NextResponse.json({ error: "UNKNOWN_OPERATION" }, { status: 400 });
    }
  } catch (error) { const candidate = error instanceof Error ? error.message : "INVALID_REQUEST"; const code = safeErrors.has(candidate) ? candidate : "INVALID_REQUEST"; return NextResponse.json({ error: code }, { status: 400 }); }
}
const safeErrors = new Set(["INVALID_REQUEST", "MISSING_FIELD", "UNKNOWN_OPERATION", "INVALID_IDENTITY", "IDENTITY_CONFLICT", "INVALID_DISPLAY_NAME", "ROOM_NOT_FOUND", "ROOM_NOT_JOINABLE", "ROOM_FULL", "ROOM_NOT_READY", "STALE_ROOM_VERSION", "UNAUTHORIZED", "SESSION_NOT_FOUND", "INVALID_SPECTATOR", "SPECTATOR_FULL", "PLAYER_REPLACED", "BOT_REPLACEMENT_NOT_ALLOWED"]);
const required = <T,>(value: T | undefined): T => { if (value === undefined || value === null) throw new Error("MISSING_FIELD"); return value; };
const text = (value: string | undefined) => { if (!value?.trim()) throw new Error("MISSING_FIELD"); return value; };
const integer = (value: number | undefined) => { if (!Number.isInteger(value)) throw new Error("MISSING_FIELD"); return value!; };
