import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConnectBankDto {
  @ApiProperty({ example: 'SPARKASSE_DE_SPKADE5HXXX', description: 'Institution ID vom Provider' })
  @IsString()
  institutionId: string;
}

export class SyncAccountDto {
  @ApiProperty({ required: false, example: '2024-01-01', description: 'Startdatum für Transaktions-Sync' })
  @IsOptional()
  @IsString()
  dateFrom?: string;
}
