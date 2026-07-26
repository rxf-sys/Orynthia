import {
  IsArray, IsString, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'Max' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ required: false, example: 'Mustermann' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'altesPW123' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'neuesPW456' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class DeleteAccountDto {
  @ApiProperty({ description: 'Aktuelles Passwort zur Bestätigung der Kontolöschung' })
  @IsString()
  @MaxLength(128)
  password: string;
}

export class NotificationSettingsDto {
  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  budgetWarnings?: boolean;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  newTransactions?: boolean;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  weeklyReport?: boolean;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  monthlyReport?: boolean;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  unusualActivity?: boolean;

  @ApiProperty({ default: false })
  @IsOptional()
  @IsBoolean()
  savingsGoals?: boolean;
}

export class DashboardLayoutDto {
  @ApiProperty({ required: false, type: [String], description: 'IDs ausgeblendeter Widgets' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  hidden?: string[];

  @ApiProperty({ required: false, type: [String], description: 'Widget-Reihenfolge' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  order?: string[];
}
