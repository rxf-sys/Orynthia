import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto, LoginDto, TokenResponseDto } from './dto/auth.dto';
import { encrypt, decrypt, isEncrypted } from '../common/crypto/encryption';

const PASSWORD_RESET_TTL_MIN = 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mail: MailService,
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
        secret: this.readTwoFactorSecret(user.twoFactorSecret),
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
      data: { twoFactorSecret: encrypt(secret) },
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
      secret: this.readTwoFactorSecret(user.twoFactorSecret),
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

  /**
   * Passwort-Reset anfordern. Antwortet immer 200 (kein User-Enumeration-Leak).
   * Wenn ein Account existiert, wird ein Token erzeugt, gehasht abgelegt und
   * per E-Mail versendet (falls SMTP konfiguriert; sonst geloggt im Backend).
   */
  async requestPasswordReset(emailRaw: string): Promise<void> {
    const email = emailRaw.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60_000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpires: expires },
    });

    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    const sent = await this.mail.send({
      to: user.email,
      subject: 'Passwort zurücksetzen – Orynthia',
      html: `
        <p>Hallo${user.firstName ? ` ${user.firstName}` : ''},</p>
        <p>du hast eine Passwort-Zurücksetzung für deinen Orynthia-Account angefordert.</p>
        <p><a href="${resetLink}">Passwort jetzt zurücksetzen</a></p>
        <p>Der Link ist ${PASSWORD_RESET_TTL_MIN} Minuten gültig. Falls du diese Anfrage nicht ausgelöst hast, ignoriere diese E-Mail – dein Passwort bleibt unverändert.</p>
        <p style="color:#888;font-size:12px">Orynthia – Self-Hosted Persönliche Finanzverwaltung</p>
      `,
    });
    if (!sent) {
      this.logger.warn(`Passwort-Reset-Token für ${user.email}: ${resetLink}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Passwort muss mindestens 8 Zeichen lang sein.');
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: tokenHash, passwordResetExpires: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Token ungültig oder abgelaufen.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshToken: null,
      },
    });
  }

  /**
   * Räumt abgelaufene Passwort-Reset-Tokens auf. Tokens wachsen sonst monatlich an
   * (jeder Reset-Request hinterlässt einen Eintrag bis 60min später) und der
   * `passwordResetToken`-Index wird unnötig groß.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredPasswordResets() {
    try {
      const result = await this.prisma.user.updateMany({
        where: { passwordResetExpires: { lt: new Date() } },
        data: { passwordResetToken: null, passwordResetExpires: null },
      });
      if (result.count > 0) {
        this.logger.log(`Abgelaufene Passwort-Reset-Tokens bereinigt: ${result.count}`);
      }
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Cleanup expired password resets fehlgeschlagen: ${reason}`);
    }
  }

  // --- Private Helpers ---

  /**
   * Akzeptiert sowohl verschlüsselte (neue) als auch Klartext-Secrets (Bestand).
   * Bei Klartext: einmaliges, transparentes Re-Encrypt in der DB wird beim
   * nächsten generate2FASecret-Aufruf erledigt; hier nur Read-Path.
   */
  private readTwoFactorSecret(stored: string | null): string {
    if (!stored) throw new BadRequestException('2FA Secret fehlt');
    if (isEncrypted(stored)) {
      try {
        return decrypt(stored);
      } catch (err) {
        this.logger.error(`2FA-Secret-Decrypt fehlgeschlagen: ${err}`);
        throw new UnauthorizedException('2FA-Daten beschädigt – bitte 2FA neu einrichten.');
      }
    }
    // Legacy: Klartext-Secret aus pre-encryption Bestand
    return stored;
  }

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
