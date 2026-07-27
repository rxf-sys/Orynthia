import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { IntegrationsService } from '../../platform/integrations/integrations.service';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarProvider } from './providers/google.provider';
import { MinLength } from 'class-validator';

class ConnectIcsDto {
  @ApiProperty({ example: 'https://example.com/kalender.ics' })
  @IsString()
  @MaxLength(2000)
  url: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

class ConnectCalDavDto {
  @ApiProperty({ example: 'name@icloud.com', description: 'Apple-ID bzw. CalDAV-Benutzername' })
  @IsString()
  @MaxLength(200)
  username: string;

  @ApiProperty({ description: 'App-spezifisches Passwort (nie das Apple-ID-Passwort)' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  appPassword: string;

  @ApiProperty({ required: false, description: 'Abweichender CalDAV-Server (Default: iCloud)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  serverUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

class GoogleConnectDto {
  @ApiProperty({ required: false, description: 'true = bidirektionaler Sync (Schreibrechte)' })
  @IsOptional()
  @IsBoolean()
  writable?: boolean;
}

class GoogleCallbackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  code: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  state: string;
}

@ApiTags('Calendar-Integrationen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar/integrations')
export class CalendarIntegrationsController {
  constructor(
    private integrations: IntegrationsService,
    private sync: CalendarSyncService,
    private google: GoogleCalendarProvider,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const items = await this.integrations.findAllForUser(req.user!.id);
    return { googleConfigured: this.google.isConfigured(), integrations: items };
  }

  @Post('ics')
  async connectIcs(@Req() req: Request, @Body() dto: ConnectIcsDto) {
    return this.sync.connectIcs(req.user!.id, dto);
  }

  @Post('caldav')
  async connectCalDav(@Req() req: Request, @Body() dto: ConnectCalDavDto) {
    return this.sync.connectCalDav(req.user!.id, dto);
  }

  @Post('google/connect')
  async googleConnect(@Req() req: Request, @Body() dto: GoogleConnectDto) {
    return this.sync.googleStart(req.user!.id, dto?.writable === true);
  }

  @Post('google/callback')
  async googleCallback(@Req() req: Request, @Body() dto: GoogleCallbackDto) {
    return this.sync.googleCallback(req.user!.id, dto.code, dto.state);
  }

  @Post(':id/sync')
  async syncNow(@Req() req: Request, @Param('id') id: string) {
    return this.sync.syncNow(req.user!.id, id);
  }

  @Delete(':id')
  async disconnect(@Req() req: Request, @Param('id') id: string) {
    return this.sync.disconnect(req.user!.id, id);
  }
}
