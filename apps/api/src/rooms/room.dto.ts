import { IsBoolean, IsIn, IsInt, IsString, Length, Max, Min } from "class-validator";

export class CreateRoomDto {
  @IsIn(["color-clash"]) gameSlug: "color-clash" = "color-clash";
  @IsInt() @Min(2) @Max(4) capacity = 2;
}
export class JoinRoomDto { @IsString() @Length(2, 80) displayName!: string; }
export class ReadyRoomDto { @IsBoolean() ready!: boolean; @IsInt() @Min(1) expectedRoomVersion!: number; }
export class StartRoomDto { @IsInt() @Min(1) expectedRoomVersion!: number; }
