import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LinkableType, TripStatus } from '@prisma/client';

export class CreateTripDto {
  @ApiProperty({ example: 'Sommerurlaub Italien' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ required: false, example: 'Gardasee' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destination?: string;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false, example: 1500, description: 'Reisebudget (reine Planungsgröße)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999_999_999)
  budgetAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class UpdateTripDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destination?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999_999_999)
  budgetAmount?: number | null;

  @ApiProperty({ enum: TripStatus, required: false })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

/** Eine bestehende Entität mit der Reise verknüpfen. */
export class LinkEntityDto {
  @ApiProperty({ enum: LinkableType, example: 'LIST' })
  @IsEnum(LinkableType)
  type: LinkableType;

  @ApiProperty()
  @IsUUID()
  id: string;
}
