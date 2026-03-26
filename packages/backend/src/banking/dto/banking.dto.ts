import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConnectBankDto {
  @ApiProperty({ example: 'Sparkasse:::DE', description: 'Bank-Name:::Land aus der Institutionen-Liste' })
  @IsString()
  institutionId: string;
}

export class BankCallbackDto {
  @ApiProperty({ description: 'Authorization-Code aus dem Bank-Redirect' })
  @IsString()
  code: string;
}

export class SyncAccountDto {
  @ApiProperty({ required: false, example: '2024-01-01', description: 'Startdatum für Transaktions-Sync' })
  @IsOptional()
  @IsString()
  dateFrom?: string;
}
