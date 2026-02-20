import { Controller, Get, Patch, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() body: { firstName?: string; lastName?: string }) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Delete('account')
  async deleteAccount(@Req() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }
}
