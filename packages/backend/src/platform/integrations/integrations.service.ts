import { Injectable, NotFoundException } from '@nestjs/common';
import { ExternalIntegration, IntegrationProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/crypto/encryption';

// Felder, die den Vault verlassen dürfen – credentialEnc bleibt drin.
const PUBLIC_SELECT = {
  id: true,
  provider: true,
  label: true,
  status: true,
  lastSyncAt: true,
  lastError: true,
  createdAt: true,
} satisfies Prisma.ExternalIntegrationSelect;

/**
 * Token-Vault für externe Integrationen: Credentials (OAuth-Refresh-Tokens,
 * ICS-URLs, App-Passwörter) werden ausschließlich AES-256-GCM-verschlüsselt
 * gespeichert und nur modulintern entschlüsselt – nie an Clients ausgeliefert,
 * nie geloggt.
 */
@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, provider: IntegrationProvider, credential: string, label?: string) {
    return this.prisma.externalIntegration.create({
      data: { userId, provider, label, credentialEnc: encrypt(credential) },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.externalIntegration.findMany({
      where: { userId },
      select: { ...PUBLIC_SELECT, _count: { select: { calendars: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOwned(userId: string, id: string): Promise<ExternalIntegration> {
    const integration = await this.prisma.externalIntegration.findFirst({ where: { id, userId } });
    if (!integration) throw new NotFoundException('Integration nicht gefunden');
    return integration;
  }

  /** Entschlüsseltes Credential – nur für Provider-Aufrufe, niemals loggen. */
  getCredential(integration: ExternalIntegration): string {
    return decrypt(integration.credentialEnc);
  }

  async updateCredential(id: string, credential: string) {
    await this.prisma.externalIntegration.update({
      where: { id },
      data: { credentialEnc: encrypt(credential) },
    });
  }

  async markSynced(id: string) {
    await this.prisma.externalIntegration.update({
      where: { id },
      data: { status: 'CONNECTED', lastSyncAt: new Date(), lastError: null },
    });
  }

  async markError(id: string, message: string) {
    await this.prisma.externalIntegration.update({
      where: { id },
      data: { status: 'ERROR', lastError: message.slice(0, 500) },
    });
  }

  /** Löscht die Integration; abhängige Kalender/Termine kaskadieren mit. */
  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.externalIntegration.delete({ where: { id } });
    return { message: 'Integration getrennt' };
  }

  async findAllByProvider(provider: IntegrationProvider) {
    return this.prisma.externalIntegration.findMany({
      where: { provider, status: { not: 'REVOKED' } },
    });
  }
}
