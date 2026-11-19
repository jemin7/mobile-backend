import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { safeEqual } from '../common/helpers/security';

@Injectable()
export class ReceiverKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-receiver-key') ?? '';
    const expected = this.config.get<string>('RECEIVER_KEY') ?? '';
    if (!provided || !expected || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('receiver_authentication_failed');
    }
    return true;
  }
}
