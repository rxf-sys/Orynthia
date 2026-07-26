import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarIntegrationsController } from './integrations.controller';
import { IcsProvider } from './providers/ics.provider';
import { GoogleCalendarProvider } from './providers/google.provider';
import { CalDavProvider } from './providers/caldav.provider';
import { NotificationsModule } from '../../platform/notifications/notifications.module';
import { IntegrationsModule } from '../../platform/integrations/integrations.module';

@Module({
  imports: [NotificationsModule, IntegrationsModule],
  controllers: [CalendarController, CalendarIntegrationsController],
  providers: [
    CalendarService,
    CalendarSyncService,
    IcsProvider,
    GoogleCalendarProvider,
    CalDavProvider,
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
