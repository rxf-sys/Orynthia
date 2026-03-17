import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'sicheresPasswort123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'Max', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiProperty({ example: 'Mustermann', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'sicheresPasswort123!' })
  @IsString()
  @MaxLength(128)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class Enable2FADto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
