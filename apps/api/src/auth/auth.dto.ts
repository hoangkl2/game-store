import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";

export class RegisterDto {
  @IsEmail() @MaxLength(320) email!: string;
  @IsString() @Length(8, 256) password!: string;
  @IsString() @Length(2, 80) displayName!: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(320) email!: string;
  @IsString() @Length(1, 1024) password!: string;
  @IsString() @MaxLength(128) deviceLabel = "Browser";
}

export class CsrfDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{32,256}$/) csrfToken!: string;
}
