import { Controller, Post, Body, UseGuards, Get, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, Enable2FADto } from './dto/auth.dto';
import { JwtAuthGuard, JwtRefreshGuard } from './guards/jwt-auth.guard';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Neuen Benutzer registrieren' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.register(dto);
    this.setTokenCookies(res, tokens);
    return { message: 'Registrierung erfolgreich', expiresIn: tokens.expiresIn };
  }

  @Post('login')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anmelden' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    this.setTokenCookies(res, tokens);
    return { message: 'Anmeldung erfolgreich', expiresIn: tokens.expiresIn };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access Token erneuern' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401);
      return { message: 'Kein Refresh Token' };
    }

    try {
      const tokens = await this.authService.refreshFromCookie(refreshToken);
      this.setTokenCookies(res, tokens);
      return { message: 'Token erneuert', expiresIn: tokens.expiresIn };
    } catch {
      this.clearTokenCookies(res);
      res.status(401);
      return { message: 'Ungültiger Refresh Token' };
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abmelden' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout((req.user as any).id);
    this.clearTokenCookies(res);
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

  private setTokenCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 Minuten
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
      path: '/api/auth', // Refresh Token nur für Auth-Endpoints
    });
  }

  private clearTokenCookies(res: Response) {
    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', { ...COOKIE_OPTIONS, path: '/api/auth' });
  }
}
