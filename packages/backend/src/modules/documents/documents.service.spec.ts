import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { DocumentsService, MAX_DOCUMENT_BYTES } from './documents.service';
import { DocumentStorageService } from './document-storage.service';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { LinksService } from '../../platform/links/links.service';

const PDF_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockPrisma = {
    document: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockStorage = {
    newStorageKey: jest.fn().mockReturnValue('a'.repeat(48)),
    checksum: jest.fn().mockReturnValue('sha-abc'),
    write: jest.fn(),
    read: jest.fn(),
    remove: jest.fn(),
  };

  const mockLinks = { removeAllFor: jest.fn() };

  const file = (over: Partial<Parameters<DocumentsService['upload']>[1]> = {}) => ({
    originalname: 'vertrag.pdf',
    mimetype: 'application/pdf',
    size: PDF_BYTES.length,
    buffer: PDF_BYTES,
    ...over,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DocumentStorageService, useValue: mockStorage },
        { provide: LinksService, useValue: mockLinks },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    jest.clearAllMocks();
    mockStorage.newStorageKey.mockReturnValue('a'.repeat(48));
    mockStorage.checksum.mockReturnValue('sha-abc');
  });

  describe('upload – Eingangsprüfungen', () => {
    it('nimmt ein gültiges PDF an und legt es verschlüsselt ab', async () => {
      mockPrisma.document.create.mockResolvedValue({ id: 'd1' });

      await service.upload('u1', file(), {});

      expect(mockStorage.write).toHaveBeenCalledWith('a'.repeat(48), PDF_BYTES);
      const data = mockPrisma.document.create.mock.calls[0][0].data;
      expect(data.storageKey).toBe('a'.repeat(48));
      expect(data.checksum).toBe('sha-abc');
      expect(data.mimeType).toBe('application/pdf');
    });

    it('lehnt nicht erlaubte Dateitypen ab', async () => {
      await expect(
        service.upload(
          'u1',
          file({ originalname: 'boese.html', mimetype: 'text/html', buffer: Buffer.from('<h1>') }),
          {},
        ),
      ).rejects.toThrow(UnsupportedMediaTypeException);
      expect(mockStorage.write).not.toHaveBeenCalled();
    });

    it('lehnt SVG ab (aktiver Inhalt)', async () => {
      await expect(
        service.upload(
          'u1',
          file({ originalname: 'bild.svg', mimetype: 'image/svg+xml', buffer: Buffer.from('<svg') }),
          {},
        ),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('lehnt eine als PDF getarnte Datei anhand der Magic Bytes ab', async () => {
      await expect(
        service.upload(
          'u1',
          file({ buffer: Buffer.from('<html><script>alert(1)</script>') }),
          {},
        ),
      ).rejects.toThrow(UnsupportedMediaTypeException);
      expect(mockStorage.write).not.toHaveBeenCalled();
    });

    it('lehnt eine zum Typ unpassende Endung ab', async () => {
      await expect(
        service.upload('u1', file({ originalname: 'vertrag.exe' }), {}),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it('lehnt zu große Dateien ab', async () => {
      await expect(
        service.upload('u1', file({ size: MAX_DOCUMENT_BYTES + 1 }), {}),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('entfernt Pfadanteile aus dem Dateinamen', async () => {
      mockPrisma.document.create.mockResolvedValue({ id: 'd1' });

      await service.upload('u1', file({ originalname: '../../etc/passwd.pdf' }), {});

      const data = mockPrisma.document.create.mock.calls[0][0].data;
      expect(data.filename).toBe('passwd.pdf');
      expect(data.filename).not.toContain('/');
    });

    it('räumt den Blob auf, wenn der Metadatensatz scheitert', async () => {
      mockPrisma.document.create.mockRejectedValue(new Error('DB weg'));

      await expect(service.upload('u1', file(), {})).rejects.toThrow('DB weg');
      expect(mockStorage.remove).toHaveBeenCalledWith('a'.repeat(48));
    });
  });

  describe('getContent', () => {
    it('liefert den Inhalt nur bei passender Prüfsumme', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'd1',
        storageKey: 'a'.repeat(48),
        checksum: 'sha-abc',
      });
      mockStorage.read.mockResolvedValue(PDF_BYTES);

      const result = await service.getContent('u1', 'd1');
      expect(result.content).toBe(PDF_BYTES);
    });

    it('verweigert die Ausgabe bei abweichender Prüfsumme', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'd1',
        storageKey: 'a'.repeat(48),
        checksum: 'sha-anders',
      });
      mockStorage.read.mockResolvedValue(PDF_BYTES);

      await expect(service.getContent('u1', 'd1')).rejects.toThrow(BadRequestException);
    });

    it('meldet einen rotierten Schlüssel als 422 statt als Serverfehler', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'd1',
        storageKey: 'a'.repeat(48),
        checksum: 'sha-abc',
      });
      mockStorage.read.mockRejectedValue(new Error('Unsupported state or unable to authenticate data'));

      await expect(service.getContent('u1', 'd1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('wirft NotFound für fremde Dokumente (Ownership)', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);
      await expect(service.getContent('u1', 'fremd')).rejects.toThrow(NotFoundException);
      expect(mockStorage.read).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('löscht Verknüpfungen, Metadaten und Blob', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'd1', storageKey: 'a'.repeat(48) });

      await service.remove('u1', 'd1');

      expect(mockLinks.removeAllFor).toHaveBeenCalledWith('u1', 'DOCUMENT', 'd1');
      expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
      expect(mockStorage.remove).toHaveBeenCalledWith('a'.repeat(48));
    });
  });
});
