import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async getAll(
    @Req() req: Request,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.getAll((req.user as any).id, {
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    return this.notificationsService.getUnreadCount((req.user as any).id);
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    return this.notificationsService.markAsRead((req.user as any).id, id);
  }

  @Post('mark-all-read')
  async markAllAsRead(@Req() req: Request) {
    return this.notificationsService.markAllAsRead((req.user as any).id);
  }

  @Post('check')
  async runChecks(@Req() req: Request) {
    const userId = (req.user as any).id;
    await this.notificationsService.checkBudgets(userId);
    await this.notificationsService.checkLowBalance(userId, 100);
    await this.notificationsService.checkContractReminders(userId);
    await this.notificationsService.checkUnusualSpending(userId);
    return { message: 'Alle Prüfungen durchgeführt' };
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string) {
    return this.notificationsService.delete((req.user as any).id, id);
  }
}
