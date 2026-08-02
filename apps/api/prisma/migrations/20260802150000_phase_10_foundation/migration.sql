-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'MODERATOR', 'ADMINISTRATOR', 'SUPPORT');

-- CreateEnum
CREATE TYPE "AuthSessionStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'STARTING', 'IN_GAME', 'FINISHED', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RoomMemberRole" AS ENUM ('HOST', 'PLAYER', 'SPECTATOR');

-- CreateEnum
CREATE TYPE "SeatControl" AS ENUM ('HUMAN', 'BOT');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MatchmakingStatus" AS ENUM ('QUEUED', 'PROPOSED', 'ACCEPTED', 'CANCELLED', 'EXPIRED', 'MATCHED');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('CREATED', 'STARTING', 'ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReconnectStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "normalizedEmail" VARCHAR(320) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "authEpoch" INTEGER NOT NULL DEFAULT 0,
    "emailVerifiedAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "csrfTokenHash" VARCHAR(64) NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "status" "AuthSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceLabel" VARCHAR(128),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "replacedBySessionId" UUID,
    "revokedAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "normalizedHandle" VARCHAR(32) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "locale" VARCHAR(16) NOT NULL DEFAULT 'vi-VN',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "normalizedCode" VARCHAR(12) NOT NULL,
    "gameSlug" VARCHAR(64) NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "visibility" VARCHAR(16) NOT NULL DEFAULT 'PRIVATE',
    "hostIdentityId" VARCHAR(128) NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "spectatorLimit" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID,
    "identityId" VARCHAR(128) NOT NULL,
    "playerId" VARCHAR(128) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "role" "RoomMemberRole" NOT NULL DEFAULT 'PLAYER',
    "control" "SeatControl" NOT NULL DEFAULT 'HUMAN',
    "controlEpoch" INTEGER NOT NULL DEFAULT 0,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "issuerId" UUID NOT NULL,
    "recipientHint" VARCHAR(320),
    "tokenHash" VARCHAR(64) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchmakingTicket" (
    "id" UUID NOT NULL,
    "identityId" VARCHAR(128) NOT NULL,
    "userId" UUID NOT NULL,
    "gameType" VARCHAR(64) NOT NULL,
    "playlist" VARCHAR(64) NOT NULL,
    "rulePreset" VARCHAR(64) NOT NULL,
    "partyId" VARCHAR(128),
    "region" VARCHAR(32) NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "latencyMs" INTEGER,
    "expansionPolicy" JSONB NOT NULL DEFAULT '{}',
    "status" "MatchmakingStatus" NOT NULL DEFAULT 'QUEUED',
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchmakingTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "roomId" UUID,
    "gameType" VARCHAR(64) NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'CREATED',
    "gameVersion" VARCHAR(32) NOT NULL,
    "ruleConfigVersion" INTEGER NOT NULL DEFAULT 1,
    "ruleConfig" JSONB NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "eventSequence" INTEGER NOT NULL DEFAULT 0,
    "randomSeed" VARCHAR(128) NOT NULL,
    "currentTurnPlayerId" VARCHAR(128),
    "turnStartedAt" TIMESTAMP(3),
    "turnExpiresAt" TIMESTAMP(3),
    "latestSnapshotId" UUID,
    "ownerEpoch" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSeat" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "userId" UUID,
    "identityId" VARCHAR(128) NOT NULL,
    "playerId" VARCHAR(128) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "control" "SeatControl" NOT NULL DEFAULT 'HUMAN',
    "controlEpoch" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSnapshot" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "gameVersion" VARCHAR(32) NOT NULL,
    "stateVersion" INTEGER NOT NULL,
    "eventSequence" INTEGER NOT NULL,
    "projectionVersion" INTEGER NOT NULL DEFAULT 1,
    "codec" VARCHAR(32) NOT NULL DEFAULT 'JSON_AES_256_GCM',
    "encryptedPayload" TEXT NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(32) NOT NULL,
    "quarantinedAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "resultingStateVersion" INTEGER NOT NULL,
    "eventType" VARCHAR(128) NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "requestId" VARCHAR(128) NOT NULL,
    "actorPlayerId" VARCHAR(128),
    "encryptedPayload" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "identityId" VARCHAR(128) NOT NULL,
    "requestId" VARCHAR(128) NOT NULL,
    "actionHash" VARCHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "ownerToken" VARCHAR(128) NOT NULL,
    "claimExpiresAt" TIMESTAMP(3) NOT NULL,
    "accepted" BOOLEAN,
    "resultingStateVersion" INTEGER,
    "response" JSONB,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconnectSession" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "identityId" VARCHAR(128) NOT NULL,
    "playerId" VARCHAR(128) NOT NULL,
    "controlEpoch" INTEGER NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "status" "ReconnectStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastEventSequence" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconnectSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "gameType" VARCHAR(64) NOT NULL,
    "winnerPlayerId" VARCHAR(128),
    "completionReason" VARCHAR(32) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "rulePreset" VARCHAR(64) NOT NULL,
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "rated" BOOLEAN NOT NULL DEFAULT false,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultParticipant" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "userId" UUID,
    "playerId" VARCHAR(128) NOT NULL,
    "rank" INTEGER NOT NULL,
    "control" "SeatControl" NOT NULL,
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ranking" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gameType" VARCHAR(64) NOT NULL,
    "seasonId" VARCHAR(64) NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "algorithmVersion" INTEGER NOT NULL DEFAULT 1,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "code" VARCHAR(128) NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "sourceSessionId" UUID,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "grantedAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "action" VARCHAR(128) NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "actorId" VARCHAR(128),
    "subjectId" VARCHAR(128),
    "resourceType" VARCHAR(64),
    "resourceId" VARCHAR(128),
    "requestId" VARCHAR(128),
    "traceId" VARCHAR(128),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "aggregateType" VARCHAR(64) NOT NULL,
    "aggregateId" VARCHAR(128) NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "eventType" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" VARCHAR(512),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_normalizedEmail_key" ON "User"("normalizedEmail");

-- CreateIndex
CREATE INDEX "User_status_updatedAt_idx" ON "User"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_status_expiresAt_idx" ON "AuthSession"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_familyId_status_idx" ON "AuthSession"("familyId", "status");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_normalizedHandle_key" ON "Profile"("normalizedHandle");

-- CreateIndex
CREATE UNIQUE INDEX "Room_normalizedCode_key" ON "Room"("normalizedCode");

-- CreateIndex
CREATE INDEX "Room_status_expiresAt_idx" ON "Room"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Room_hostIdentityId_status_idx" ON "Room"("hostIdentityId", "status");

-- CreateIndex
CREATE INDEX "RoomMember_identityId_updatedAt_idx" ON "RoomMember"("identityId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_identityId_key" ON "RoomMember"("roomId", "identityId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_playerId_key" ON "RoomMember"("roomId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_seatIndex_key" ON "RoomMember"("roomId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_roomId_status_idx" ON "Invitation"("roomId", "status");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "MatchmakingTicket_identityId_gameType_playlist_status_idx" ON "MatchmakingTicket"("identityId", "gameType", "playlist", "status");

-- CreateIndex
CREATE INDEX "MatchmakingTicket_status_gameType_region_rating_enteredAt_idx" ON "MatchmakingTicket"("status", "gameType", "region", "rating", "enteredAt");

-- CreateIndex
CREATE INDEX "MatchmakingTicket_expiresAt_idx" ON "MatchmakingTicket"("expiresAt");

-- CreateIndex
CREATE INDEX "GameSession_roomId_status_idx" ON "GameSession"("roomId", "status");

-- CreateIndex
CREATE INDEX "GameSession_status_updatedAt_idx" ON "GameSession"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSeat_gameSessionId_identityId_key" ON "GameSeat"("gameSessionId", "identityId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSeat_gameSessionId_playerId_key" ON "GameSeat"("gameSessionId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSeat_gameSessionId_seatIndex_key" ON "GameSeat"("gameSessionId", "seatIndex");

-- CreateIndex
CREATE INDEX "GameSnapshot_gameSessionId_stateVersion_idx" ON "GameSnapshot"("gameSessionId", "stateVersion" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GameSnapshot_gameSessionId_stateVersion_key" ON "GameSnapshot"("gameSessionId", "stateVersion");

-- CreateIndex
CREATE INDEX "GameEvent_requestId_idx" ON "GameEvent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_gameSessionId_sequence_key" ON "GameEvent"("gameSessionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_gameSessionId_requestId_sequence_key" ON "GameEvent"("gameSessionId", "requestId", "sequence");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_status_claimExpiresAt_idx" ON "IdempotencyRecord"("status", "claimExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_gameSessionId_identityId_requestId_key" ON "IdempotencyRecord"("gameSessionId", "identityId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconnectSession_tokenHash_key" ON "ReconnectSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ReconnectSession_gameSessionId_identityId_status_idx" ON "ReconnectSession"("gameSessionId", "identityId", "status");

-- CreateIndex
CREATE INDEX "ReconnectSession_expiresAt_idx" ON "ReconnectSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_gameSessionId_key" ON "GameResult"("gameSessionId");

-- CreateIndex
CREATE INDEX "ResultParticipant_userId_createdAt_idx" ON "ResultParticipant"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResultParticipant_resultId_playerId_key" ON "ResultParticipant"("resultId", "playerId");

-- CreateIndex
CREATE INDEX "Ranking_gameType_seasonId_rating_idx" ON "Ranking"("gameType", "seasonId", "rating" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Ranking_userId_gameType_seasonId_key" ON "Ranking"("userId", "gameType", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_definitionVersion_key" ON "Achievement"("code", "definitionVersion");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_grantedAt_idx" ON "UserAchievement"("userId", "grantedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_definitionVersion_sour_key" ON "UserAchievement"("userId", "achievementId", "definitionVersion", "sourceSessionId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_subjectId_occurredAt_idx" ON "AuditLog"("subjectId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_occurredAt_idx" ON "AuditLog"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_aggregateType_aggregateId_aggregateVersion_even_key" ON "OutboxEvent"("aggregateType", "aggregateId", "aggregateVersion", "eventType");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSeat" ADD CONSTRAINT "GameSeat_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSeat" ADD CONSTRAINT "GameSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSnapshot" ADD CONSTRAINT "GameSnapshot_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconnectSession" ADD CONSTRAINT "ReconnectSession_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultParticipant" ADD CONSTRAINT "ResultParticipant_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "GameResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultParticipant" ADD CONSTRAINT "ResultParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Phase 10 hardening indexes that Prisma cannot express as partial unique indexes.
CREATE UNIQUE INDEX "one_active_matchmaking_ticket_per_identity"
ON "MatchmakingTicket"("identityId", "gameType", "playlist")
WHERE "status" IN ('QUEUED', 'PROPOSED', 'ACCEPTED');

CREATE UNIQUE INDEX "one_active_game_session_per_room"
ON "GameSession"("roomId")
WHERE "roomId" IS NOT NULL AND "status" IN ('CREATED', 'STARTING', 'ACTIVE', 'PAUSED');

-- Durable command journal used to rebuild a current state from the last valid snapshot.
CREATE TABLE "GameCommand" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "stateVersion" INTEGER NOT NULL,
    "requestId" VARCHAR(128) NOT NULL,
    "actorPlayerId" VARCHAR(128) NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameCommand_gameSessionId_stateVersion_key" ON "GameCommand"("gameSessionId", "stateVersion");
CREATE UNIQUE INDEX "GameCommand_gameSessionId_requestId_key" ON "GameCommand"("gameSessionId", "requestId");
CREATE INDEX "GameCommand_gameSessionId_stateVersion_idx" ON "GameCommand"("gameSessionId", "stateVersion" ASC);
ALTER TABLE "GameCommand" ADD CONSTRAINT "GameCommand_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchmakingTicket" ADD CONSTRAINT "MatchmakingTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
