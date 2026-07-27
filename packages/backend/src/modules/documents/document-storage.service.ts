import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { encryptBuffer, decryptBuffer } from '../../platform/common/crypto/encryption';

/**
 * Verschlüsselte Dateiablage.
 *
 * Dateien liegen nie im Klartext auf der Platte und nie in der Datenbank:
 * der Inhalt wird mit AES-256-GCM verschlüsselt (derselbe ENCRYPTION_KEY wie
 * für Banking-Sessions) und unter einem zufälligen Storage-Schlüssel
 * abgelegt. Der ursprüngliche Dateiname beeinflusst den Pfad nicht –
 * Path-Traversal ist damit strukturell ausgeschlossen.
 */
@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly root: string;

  constructor(private config: ConfigService) {
    this.root = path.resolve(
      this.config.get<string>('DOCUMENTS_PATH') || path.join(process.cwd(), 'data', 'documents'),
    );
  }

  /** Zufälliger Storage-Schlüssel; nie aus Nutzereingaben abgeleitet. */
  newStorageKey(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  checksum(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private resolvePath(storageKey: string): string {
    // Doppelte Absicherung: der Key ist per Konstruktion hexadezimal
    if (!/^[0-9a-f]{48}$/.test(storageKey)) {
      throw new InternalServerErrorException('Ungültiger Storage-Schlüssel');
    }
    // Zweistufige Fächerung, damit ein Verzeichnis nicht beliebig groß wird
    return path.join(this.root, storageKey.slice(0, 2), storageKey);
  }

  async write(storageKey: string, content: Buffer): Promise<void> {
    const target = this.resolvePath(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // Restriktive Rechte: nur der App-User darf lesen
    await fs.writeFile(target, encryptBuffer(content), { mode: 0o600 });
  }

  async read(storageKey: string): Promise<Buffer> {
    const encrypted = await fs.readFile(this.resolvePath(storageKey));
    // Wirft bei manipulierten Daten dank GCM-Auth-Tag
    return decryptBuffer(encrypted);
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(storageKey));
    } catch (e) {
      // Fehlende Datei ist kein Grund, das Löschen des Metadatensatzes zu blockieren
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Datei konnte nicht gelöscht werden: ${(e as Error).message}`);
      }
    }
  }
}
