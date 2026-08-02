import { Equals, IsDateString, IsInt, IsObject, IsString, Matches, Min } from "class-validator";

export class GameActionDto {
  @Equals(1) protocolVersion!: 1;
  @IsString() @Matches(/^[a-zA-Z0-9_-]{3,128}$/) requestId!: string;
  @IsString() playerId!: string;
  @IsInt() @Min(0) expectedStateVersion!: number;
  @IsDateString() sentAt!: string;
  @IsObject() action!: Record<string, unknown>;
}

export class ReconnectDto { @IsString() @Matches(/^[a-f\d-]{36}\.[A-Za-z0-9_-]{43}$/i) reconnectToken!: string; }
