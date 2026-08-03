import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@Req() request: AuthenticatedRequest): { username: string } {
    return { username: request.user?.username ?? 'test-user' };
  }
}
