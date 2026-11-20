import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { MobileAttendancePunchDto } from './dto/mobile-attendance-punch.dto';
import type { Request } from 'express';

import { MobileJwtAuthGuard } from '../auth/mobile-jwt-auth.guard';
import { MobileAttendanceService } from './mobile-attendance.service';
import { JwtService } from '@nestjs/jwt';


@Controller('api/mobile/v1/attendance')
@UseGuards(MobileJwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MobileAttendanceController {
   constructor(
    private readonly attendanceService: MobileAttendanceService,
    private readonly jwt: JwtService,
  ) {}
  private getEmployeeId(
    request: Request & { user?: Record<string, any> },
  ): number {
    if (request.user?.type !== 'employee') {
      throw new ForbiddenException(
        'Attendance is available only for employee accounts.',
      );
    }

    const employeeId = Number(request.user.employeeId);

    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      throw new UnauthorizedException('Employee ID not found in token.');
    }

    return employeeId;
  }


   @Get('server-time')
  async getServerTime(
    @Req() request: Request & { user?: Record<string, any> },
  ) {
    const employeeId = this.getEmployeeId(request);
    const serverUtcMs = Date.now();

    const timeProof = await this.jwt.signAsync(
      {
        purpose: 'mobile-attendance-time',
        employeeId,
        serverUtcMs,
      },
      { expiresIn: '24h' },
    );

    return {
      serverUtcMs,
      timeProof,
    };
  }


    @Post('punch')
  recordPunch(
    @Req() request: Request & { user?: Record<string, any> },
    @Body() dto: MobileAttendancePunchDto,
  ) {
    return this.attendanceService.recordPunch(
      this.getEmployeeId(request),
      dto,
    );
  }

  @Get('today')
  getToday(
    @Req() request: Request & { user?: Record<string, any> },
  ) {
    return this.attendanceService.getTodayStatus(
      this.getEmployeeId(request),
    );
  }

  @Get('my')
  getMyRecords(
    @Req() request: Request & { user?: Record<string, any> },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getMyRecords(
      this.getEmployeeId(request),
      from,
      to,
    );
  }
}