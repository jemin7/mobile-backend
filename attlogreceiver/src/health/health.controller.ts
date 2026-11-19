import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(['/', 'health'])
  @SkipThrottle()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { success: true, status: 'ok' };
  }
}
