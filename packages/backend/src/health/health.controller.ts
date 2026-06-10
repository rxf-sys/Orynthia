import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  private redis: Redis | null = null;

  constructor(private prisma: PrismaService) {
    // Redis ist optional (derzeit nur in der Infrastruktur provisioniert);
    // geprüft wird nur, wenn eine URL konfiguriert ist.
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
    }
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness – Prozess antwortet' })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness – DB (Pflicht) und Redis (falls konfiguriert) erreichbar' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err: unknown) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        db: 'down',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Redis ist kein harter Blocker (kein Code-Pfad hängt aktuell davon ab),
    // wird aber als Status mitgemeldet, damit Monitoring Drift erkennt.
    let redis = 'not_configured';
    if (this.redis) {
      try {
        await this.redis.ping();
        redis = 'up';
      } catch {
        redis = 'down';
      }
    }

    return { status: 'ready', db: 'up', redis };
  }
}
