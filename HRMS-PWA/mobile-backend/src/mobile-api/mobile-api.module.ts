import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CompanyModuleAccessModule } from '../common/company-module-access.module';

import { MobileAuthController } from './auth/mobile-auth.controller';
import { MobileAuthService } from './auth/mobile-auth.service';
import { MobileJwtStrategy } from './auth/mobile-jwt.strategy';

import { MailModule } from '../mail/mail.module';
import { MobileJwtAuthGuard } from './auth/mobile-jwt-auth.guard';

import { MobileAttendanceController } from './attendance/mobile-attendance.controller';
import { MobileAttendanceService } from './attendance/mobile-attendance.service';

import { MobileProfileController } from './profile/mobile-profile.controller';
import { MobileProfileService } from './profile/mobile-profile.service';

@Module({
  imports: [
  PassportModule.register({ defaultStrategy: 'mobile-jwt' }),
  JwtModule.register({
    secret: process.env.JWT_SECRET || 'secret123',
  }),
  CompanyModuleAccessModule,
  MailModule,
],

controllers: [
  MobileAuthController,
  MobileAttendanceController,
  MobileProfileController,
],
providers: [
  MobileAuthService,
  MobileAttendanceService,
  MobileProfileService,
  MobileJwtStrategy,
  MobileJwtAuthGuard,
],
})
export class MobileApiModule {}
