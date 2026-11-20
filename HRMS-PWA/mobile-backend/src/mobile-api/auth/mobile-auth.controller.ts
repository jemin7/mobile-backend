import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
  Get,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { MobileJwtAuthGuard } from './mobile-jwt-auth.guard';

import { MobileAuthService } from './mobile-auth.service';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { MobileRefreshDto } from './dto/mobile-refresh.dto';
import {
  MobileForgotPasswordDto,
  MobileVerifyForgotPasswordDto,
} from './dto/mobile-password-recovery.dto';

@Controller('api/mobile/v1/auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MobileAuthController {
  constructor(private readonly mobileAuthService: MobileAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: MobileLoginDto, @Req() request: Request) {
    return this.mobileAuthService.login(dto, request);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: MobileRefreshDto) {
    return this.mobileAuthService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: MobileRefreshDto) {
    return this.mobileAuthService.logout(dto.refreshToken);
  }

    @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: MobileForgotPasswordDto) {
    return this.mobileAuthService.forgotPassword(dto);
  }

  @Post('forgot-password/verify')
  @HttpCode(HttpStatus.OK)
  verifyForgotPassword(@Body() dto: MobileVerifyForgotPasswordDto) {
    return this.mobileAuthService.verifyForgotPassword(dto);
  }

  @Get('me')
  @UseGuards(MobileJwtAuthGuard)
  getCurrentSession(@Req() request: Request & { user?: Record<string, any> }) {
    const user = request.user;

    return {
      id: user?.sub,
      employeeId: user?.employeeId,
      username: user?.username,
      role: user?.role,
      type: user?.type,
      companyID: user?.companyID,
      branchesID: user?.branchesID,
    };
  }
}
