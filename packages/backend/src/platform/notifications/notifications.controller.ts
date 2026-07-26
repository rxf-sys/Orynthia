import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.findAll(req.user!.id, {
      unread: unread === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('count')
  async unreadCount(@Req() req: Request) {
    return { count: await this.notifications.getUnreadCount(req.user!.id) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markAsRead(req.user!.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@Req() req: Request) {
    return this.notifications.markAllAsRead(req.user!.id);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.remove(req.user!.id, id);
  }
}
