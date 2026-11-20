import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { CompanyModuleAccessService } from '../../common/company-module-access.service';
import { PrismaService } from '../../prisma/prisma.service';

function jwtFromAccessTokenCookie(req: Request): string | null {
  const raw = req?.headers?.cookie;
  if (!raw) return null;
  const match = raw.match(/(?:^|;\s*)accessToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

import {
  MOBILE_SESSION_ACTIVITY_UPDATE_INTERVAL_MS,
  MOBILE_SESSION_IDLE_TIMEOUT_MS,
} from '../../mobile-api/auth/mobile-auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly moduleAccess: CompanyModuleAccessService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        jwtFromAccessTokenCookie,
      ]),
      secretOrKey: process.env.JWT_SECRET || 'secret123',
    });
  }

  async validate(payload: any) {
    if (payload?.client === 'mobile') {
      const sid = String(payload.sid || '');

      const session = sid
        ? await this.prisma.mobileAuthSession.findUnique({
            where: { id: sid },
            select: {
              accountType: true,
              userID: true,
              employeeID: true,
             expiresAt: true,
             revokedAt: true,
             lastUsedAt: true,
             createdAt: true,
            },
          })
        : null;

      const isEmployee = payload.type === 'employee';

      const matchesAccount = isEmployee
        ? session?.accountType === 'EMPLOYEE' &&
          Number(payload.sub) === session.employeeID &&
          Number(payload.employeeId ?? payload.sub) === session.employeeID
        : payload.type === 'user' &&
          session?.accountType === 'USER' &&
          Number(payload.sub) === session.userID;

    const now = new Date();
const lastActivityAt = session?.lastUsedAt ?? session?.createdAt;

const isIdleExpired =
  !lastActivityAt ||
  now.getTime() - lastActivityAt.getTime() >=
    MOBILE_SESSION_IDLE_TIMEOUT_MS;

if (session && !session.revokedAt && isIdleExpired) {
  await this.prisma.mobileAuthSession.updateMany({
    where: { id: sid, revokedAt: null },
    data: {
      revokedAt: now,
      revokeReason: 'INACTIVITY_TIMEOUT',
    },
  });
}

if (
  !session ||
  session.revokedAt ||
  session.expiresAt <= now ||
  !matchesAccount ||
  isIdleExpired
) {
  throw new UnauthorizedException('Mobile session expired or revoked.');
}

if (
  lastActivityAt &&
  now.getTime() - lastActivityAt.getTime() >=
    MOBILE_SESSION_ACTIVITY_UPDATE_INTERVAL_MS
) {
  await this.prisma.mobileAuthSession.updateMany({
    where: {
      id: sid,
      revokedAt: null,
      lastUsedAt: session.lastUsedAt,
    },
    data: { lastUsedAt: now },
  });
}
    }

    if (payload?.type === 'employee') {
      const employeeId = Number(payload.employeeId || payload.sub);
      const creds = Number.isFinite(employeeId) && employeeId > 0
        ? await this.prisma.employeeCredentials.findUnique({
            where: { employeeID: employeeId },
            select: { isActive: true },
          })
        : null;
      if (!creds?.isActive) {
        throw new UnauthorizedException('ACCOUNT_DISABLED');
      }
    }
    try {
      await this.moduleAccess.assertSessionAllowed(payload?.companyID, payload?.role);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('SUBSCRIPTION_EXPIRED');
    }
    return payload;
  }
}
