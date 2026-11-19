import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardLayoutController } from './dashboard-layout.controller';
import { DashboardLayoutService } from './dashboard-layout.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardLayoutController],
  providers: [DashboardLayoutService],
})
export class DashboardLayoutModule {}
