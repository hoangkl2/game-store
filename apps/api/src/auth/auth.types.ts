import type { UserRole } from "@prisma/client";

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  epoch: number;
  role: UserRole;
  type: "access";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface AuthPrincipal { identityId: string; userId: string; sessionId: string; authEpoch: number; role: UserRole }
