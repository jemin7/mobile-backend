import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';

import { MobileJwtAuthGuard } from '../auth/mobile-jwt-auth.guard';
import { MobileProfileService } from './mobile-profile.service';

@Controller('api/mobile/v1/profile')
@UseGuards(MobileJwtAuthGuard)
export class MobileProfileController {
  constructor(
    private readonly profileService: MobileProfileService,
  ) {}

  private getEmployeeId(
    request: Request & { user?: Record<string, any> },
  ): number {
    if (request.user?.type !== 'employee') {
      throw new ForbiddenException(
        'Profile is available only for employee accounts.',
      );
    }

    const employeeId = Number(request.user.employeeId);

    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
      throw new UnauthorizedException('Employee ID not found in token.');
    }

    return employeeId;
  }

  @Get('me')
  getMyProfile(
    @Req() request: Request & { user?: Record<string, any> },
  ) {
    return this.profileService.getMyProfile(
      this.getEmployeeId(request),
    );
  }


    @Post('photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads',
        filename: (_request, file, callback) => {
          const extensions: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/heic': '.heic',
            'image/heif': '.heif',
          };

          callback(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${extensions[file.mimetype]}`,
          );
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Unsupported image format.'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  updateMyProfilePhoto(
    @Req() request: Request & { user?: Record<string, any> },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A valid image file is required.');
    }

    return this.profileService.updateMyProfilePhoto(
      this.getEmployeeId(request),
      `/uploads/${file.filename}`,
    );
  }
}