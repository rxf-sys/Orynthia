import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, TokenResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    // Prüfe ob E-Mail schon existiert
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('E-Mail-Adresse bereits registriert');
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // User erstellen
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    // System-Kategorien für User kopieren (Batch-Insert)
    const systemCategories = await this.prisma.category.findMany({
      where: { isSystem: true },
    });

    if (systemCategories.length > 0) {
      await this.prisma.category.createMany({
        data: systemCategories.map((cat) => ({
          userId: user.id,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          keywords: cat.keywords,
          isSystem: false,
        })),
      });
    }

    return this.generateTokens(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Ungültige Anmeldedaten');
    }

    // 2FA Prüfung
    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        throw new BadRequestException('2FA-Code erforderlich');
      }
      const isValid = authenticator.verify({
        token: dto.twoFactorCode,
        secret: user.twoFactorSecret!,
      });
      if (!isValid) {
        throw new UnauthorizedException('Ungültiger 2FA-Code');
      }
    }

    // Last Login aktualisieren
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user.id, user.email);
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<TokenResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Zugang verweigert');
    }

    const tokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenValid) {
      throw new UnauthorizedException('Ungültiger Refresh Token');
    }

    return this.generateTokens(user.id, user.email);
  }

  async refreshFromCookie(refreshToken: string): Promise<TokenResponseDto> {
    // Refresh Token verifizieren und User-ID extrahieren
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });

    return this.refreshTokens(payload.sub, refreshToken);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async generate2FASecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Orynthia', secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    const qrCode = await QRCode.toDataURL(otpauthUrl);
    return { secret, qrCode };
  }

  async enable2FA(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA Secret nicht generiert');
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Ungültiger 2FA-Code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return true;
  }

  async disable2FA(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });
  }

  // --- Private Helpers ---

  private async generateTokens(userId: string, email: string): Promise<TokenResponseDto> {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);

    // Refresh Token gehasht speichern
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefresh },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 Minuten in Sekunden
    };
  }
}
