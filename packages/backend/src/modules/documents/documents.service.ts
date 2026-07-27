import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { LinksService } from '../../platform/links/links.service';
import { DocumentStorageService } from './document-storage.service';
import { UpdateDocumentDto, UploadDocumentDto } from './dto/document.dto';

/** Maximale Dateigröße pro Dokument (20 MB). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/**
 * Erlaubte Dateitypen – bewusst eine Whitelist. Aktive Inhalte
 * (HTML, SVG, Skripte, Archive) sind ausgeschlossen: sie könnten beim
 * Öffnen im Browser Code im Kontext der App ausführen.
 */
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

/** Magic Bytes der Formate, bei denen sich eine Inhaltsprüfung lohnt. */
const MAGIC_BYTES: Array<{ mime: string; prefix: number[] }> = [
  { mime: 'application/pdf', prefix: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', prefix: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', prefix: [0x89, 0x50, 0x4e, 0x47] },
];

/**
 * Felder, die nach außen gehen. `storageKey` und `userId` fehlen bewusst:
 * der Ablageschlüssel gehört zur Verschlüsselungsschicht und hat in keiner
 * API-Antwort etwas verloren.
 */
const PUBLIC_FIELDS = {
  id: true,
  title: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  tags: true,
  notes: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: DocumentStorageService,
    private links: LinksService,
  ) {}

  async findAll(userId: string, opts: { search?: string; tag?: string } = {}) {
    return this.prisma.document.findMany({
      where: {
        userId,
        ...(opts.search
          ? {
              OR: [
                { title: { contains: opts.search, mode: 'insensitive' } },
                { filename: { contains: opts.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(opts.tag ? { tags: { has: opts.tag } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: PUBLIC_FIELDS,
    });
  }

  async findOne(userId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, userId },
      select: PUBLIC_FIELDS,
    });
    if (!document) throw new NotFoundException('Dokument nicht gefunden');
    return document;
  }

  /** Interner Zugriff inklusive Ablageschlüssel – nur für Datei-Operationen. */
  private async findOwned(userId: string, id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, userId } });
    if (!document) throw new NotFoundException('Dokument nicht gefunden');
    return document;
  }

  /**
   * Datei annehmen: Typ und Größe prüfen, Inhalt verschlüsselt ablegen,
   * Metadaten speichern. Der Klartext verlässt den Prozess nie.
   */
  async upload(
    userId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    dto: UploadDocumentDto,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Keine Datei übermittelt');
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new PayloadTooLargeException('Datei ist größer als 20 MB');
    }

    const mimeType = file.mimetype.split(';')[0].trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      throw new UnsupportedMediaTypeException(
        `Dateityp ${mimeType} ist nicht erlaubt. Zulässig sind PDF, Bilder und Office-Dokumente.`,
      );
    }
    // Endung muss zum gemeldeten Typ passen – erschwert getarnte Uploads
    const extension = this.extensionOf(file.originalname);
    if (extension && !ALLOWED_MIME_TYPES[mimeType].includes(extension)) {
      throw new UnsupportedMediaTypeException('Dateiendung passt nicht zum Dateityp');
    }
    this.assertMagicBytes(mimeType, file.buffer);

    const storageKey = this.storage.newStorageKey();
    const checksum = this.storage.checksum(file.buffer);
    await this.storage.write(storageKey, file.buffer);

    try {
      return await this.prisma.document.create({
        data: {
          userId,
          title: dto.title?.trim() || this.sanitizeFilename(file.originalname),
          filename: this.sanitizeFilename(file.originalname),
          mimeType,
          sizeBytes: file.size,
          storageKey,
          checksum,
          tags: dto.tags ?? [],
          notes: dto.notes,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        },
        select: PUBLIC_FIELDS,
      });
    } catch (e) {
      // Kein verwaister Blob, wenn der Metadatensatz scheitert
      await this.storage.remove(storageKey);
      throw e;
    }
  }

  /** Entschlüsselten Inhalt für den Download – inklusive Integritätsprüfung. */
  async getContent(userId: string, id: string) {
    const document = await this.findOwned(userId, id);

    let content: Buffer;
    try {
      content = await this.storage.read(document.storageKey);
    } catch (e) {
      // Häufigster echter Fall: der ENCRYPTION_KEY wurde rotiert. Das ist
      // kein Serverfehler, sondern eine Aussage über den Datenbestand –
      // also eine klare Meldung statt eines 500ers.
      this.logger.error(`Dokument ${document.id} nicht lesbar: ${(e as Error).message}`);
      throw new UnprocessableEntityException(
        'Datei konnte nicht entschlüsselt werden. Wurde der ENCRYPTION_KEY geändert oder die Ablage verändert?',
      );
    }

    if (this.storage.checksum(content) !== document.checksum) {
      this.logger.error(`Prüfsumme weicht ab (Dokument ${document.id})`);
      throw new BadRequestException('Datei ist beschädigt und wurde nicht ausgeliefert');
    }
    return { document, content };
  }

  async update(userId: string, id: string, dto: UpdateDocumentDto) {
    await this.findOne(userId, id);
    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
      },
      select: PUBLIC_FIELDS,
    });
  }

  async remove(userId: string, id: string) {
    const document = await this.findOwned(userId, id);
    await this.links.removeAllFor(userId, 'DOCUMENT', id);
    await this.prisma.document.delete({ where: { id } });
    await this.storage.remove(document.storageKey);
    return { message: 'Dokument gelöscht' };
  }

  async getTags(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: { userId },
      select: { tags: true },
    });
    const counts = new Map<string, number>();
    for (const doc of documents) {
      for (const tag of doc.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  /** Schmale Public API für die globale Suche. */
  async search(userId: string, q: string, limit = 5) {
    return this.prisma.document.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { filename: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, mimeType: true },
      take: limit,
    });
  }

  // ---------- Helfer ----------

  private extensionOf(filename: string): string | null {
    const match = /\.[a-z0-9]+$/i.exec(filename.trim());
    return match ? match[0].toLowerCase() : null;
  }

  /** Pfadanteile und Steuerzeichen aus dem Anzeigenamen entfernen. */
  private sanitizeFilename(filename: string): string {
    const base = filename.split(/[/\\]/).pop() ?? 'datei';
     
    return base.replace(/[ -"<>|:*?]/g, '').slice(0, 200) || 'datei';
  }

  /**
   * Für Formate mit eindeutiger Signatur prüfen, ob der Inhalt zum
   * gemeldeten Typ passt – eine als PDF deklarierte HTML-Datei fliegt so auf.
   */
  private assertMagicBytes(mimeType: string, buffer: Buffer) {
    const expected = MAGIC_BYTES.find((m) => m.mime === mimeType);
    if (!expected) return;
    const matches = expected.prefix.every((byte, i) => buffer[i] === byte);
    if (!matches) {
      throw new UnsupportedMediaTypeException('Dateiinhalt passt nicht zum angegebenen Dateityp');
    }
  }
}
