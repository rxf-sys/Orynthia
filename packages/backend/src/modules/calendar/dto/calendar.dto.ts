import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventRecurrence } from '@prisma/client';

export class CreateCalendarDto {
  @ApiProperty({ example: 'Privat' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, example: '#5b8def' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCalendarDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateEventDto {
  @ApiProperty({ required: false, description: 'Ziel-Kalender; ohne Angabe der Standard-Kalender' })
  @IsOptional()
  @IsUUID()
  calendarId?: string;

  @ApiProperty({ example: 'Zahnarzt' })
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiProperty({ example: '2026-08-01T09:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2026-08-01T10:00:00.000Z' })
  @IsDateString()
  endsAt: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

  @ApiProperty({ required: false, description: 'Minuten vor Beginn', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  reminderMinutes?: number;

  @ApiProperty({ enum: EventRecurrence, required: false })
  @IsOptional()
  @IsEnum(EventRecurrence)
  recurrence?: EventRecurrence;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  recurrenceInterval?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  recurrenceUntil?: string;
}

export class UpdateEventDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  calendarId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isAllDay?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  reminderMinutes?: number | null;

  @ApiProperty({ enum: EventRecurrence, required: false, nullable: true })
  @IsOptional()
  @IsEnum(EventRecurrence)
  recurrence?: EventRecurrence | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  recurrenceInterval?: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  recurrenceUntil?: string | null;
}
