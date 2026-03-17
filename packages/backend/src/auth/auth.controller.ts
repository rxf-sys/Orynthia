import { Controller, Post, Body, UseGuards, Get, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, Enable2FADto } from './dto/auth.dto';
import { JwtAuthGuard, JwtRefreshGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Neuen Benutzer registrieren' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anmelden' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access Token erneuern' })
  async refresh(@Req() req: Request, @Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens((req.user as any).sub, dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abmelden' })
  async logout(@Req() req: Request) {
    await this.authService.logout((req.user as any).id);
    return { message: 'Erfolgreich abgemeldet' };
  }

  @Get('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '2FA Secret generieren' })
  async generate2FA(@Req() req: Request) {
    return this.authService.generate2FASecret((req.user as any).id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA aktivieren' })
  async enable2FA(@Req() req: Request, @Body() dto: Enable2FADto) {
    return this.authService.enable2FA((req.user as any).id, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA deaktivieren' })
  async disable2FA(@Req() req: Request) {
    await this.authService.disable2FA((req.user as any).id);
    return { message: '2FA deaktiviert' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aktueller Benutzer' })
  async getProfile(@Req() req: Request) {
    return req.user;
  }
}
