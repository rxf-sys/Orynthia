import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private fromAddress = 'noreply@orynthia.local';
  private enabled = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    const from = this.config.get<string>('SMTP_FROM');
    if (from) this.fromAddress = from;

    if (!host) {
      this.logger.log('SMTP_HOST nicht gesetzt – Mail-Versand deaktiviert (Mails werden nur geloggt).');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.enabled = true;
    this.logger.log(`Mail-Transport bereit: ${user ?? '(anonym)'}@${host}:${port}`);
  }

  isEnabled() {
    return this.enabled;
  }

  async send(options: MailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Mail nicht gesendet (kein SMTP konfiguriert): "${options.subject}" → ${options.to}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? stripHtml(options.html),
      });
      return true;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Mail-Versand fehlgeschlagen ("${options.subject}" → ${options.to}): ${reason}`);
      return false;
    }
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
