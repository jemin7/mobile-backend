import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { clientIp } from '../common/helpers/request';

@Injectable()
export class DeviceIpGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const allowlist = (this.config.get<string>('DEVICE_IP_ALLOWLIST') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (allowlist.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const ip = clientIp(request);
    if (!allowlist.includes(ip)) {
      throw new ForbiddenException('ip_not_allowed');
    }
    return true;
  }
}
