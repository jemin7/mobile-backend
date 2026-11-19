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
