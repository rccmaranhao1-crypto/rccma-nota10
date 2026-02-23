import { IsDateString, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { Diocese } from "@prisma/client";

export class RegisterDto {
  @IsString() @IsNotEmpty()
  name!: string;

  @IsString() @IsNotEmpty()
  whatsapp!: string; // (XX) XXXXX-XXXX

  @IsDateString()
  birthDate!: string; // ISO

  @IsEnum(Diocese)
  diocese!: Diocese;

  @IsString() @IsNotEmpty()
  city!: string;

  @IsString() @IsNotEmpty()
  prayerGroup!: string;

  @IsString() @MinLength(4)
  password!: string;
}

export class LoginDto {
  @IsString() @IsNotEmpty()
  whatsapp!: string;

  @IsString() @IsNotEmpty()
  password!: string;
}
