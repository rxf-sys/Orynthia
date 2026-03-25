import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
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
  newPassword: string;
}
