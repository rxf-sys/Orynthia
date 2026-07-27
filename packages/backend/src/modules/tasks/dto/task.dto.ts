import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskPriority, TaskRecurrence } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Steuererklärung vorbereiten' })
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiProperty({ enum: TaskPriority, required: false, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ required: false, example: '2026-08-01T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiProperty({ enum: TaskRecurrence, required: false })
  @IsOptional()
  @IsEnum(TaskRecurrence)
  recurrence?: TaskRecurrence;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  taskListId?: string;
}

export class UpdateTaskDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiProperty({ enum: TaskPriority, required: false })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  // null erlaubt das Entfernen einer Fälligkeit
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @ApiProperty({ enum: TaskRecurrence, required: false, nullable: true })
  @IsOptional()
  @IsEnum(TaskRecurrence)
  recurrence?: TaskRecurrence | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  taskListId?: string | null;

  @ApiProperty({ required: false, description: 'true = erledigt, false = wieder offen' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class CreateTaskListDto {
  @ApiProperty({ example: 'Haushalt' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, example: '#5b8def' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class UpdateTaskListDto {
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
}
