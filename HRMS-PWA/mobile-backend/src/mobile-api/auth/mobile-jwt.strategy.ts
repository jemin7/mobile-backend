import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { MobileAuthAccountType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CompanyModuleAccessService } from '../../common/company-module-access.service';
import {
  MOBILE_SESSION_ACTIVITY_UPDATE_INTERVAL_MS,
  MOBILE_SESSION_IDLE_TIMEOUT_MS,
} from './mobile-auth.constants';

@Injectable()
export class MobileJwtStrategy extends PassportStrategy(
  Strategy,
  'mobile-jwt',
) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleAccess: CompanyModuleAccessService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secret123',
    });
  }

  async validate(payload: Record<string, any>) {
    if (payload.client !== 'mobile' || !payload.sid) {
      throw new UnauthorizedException('Invalid mobile access token.');
    }

    const session = await this.prisma.mobileAuthSession.findUnique({
      where: { id: String(payload.sid) },
      include: {
        user: {
          include: {
            userCompanies: true,
          },
        },
        employee: {
          include: {
            employeeCredentials: {
              select: {
                isActive: true,
              },
            },
          },
        },
      },
    });

   const now = new Date();
const lastActivityAt = session?.lastUsedAt ?? session?.createdAt;

const isIdleExpired =
  !lastActivityAt ||
  now.getTime() - lastActivityAt.getTime() >=
    MOBILE_SESSION_IDLE_TIMEOUT_MS;

if (session && !session.revokedAt && isIdleExpired) {
  await this.prisma.mobileAuthSession.updateMany({
    where: { id: session.id, revokedAt: null },
    data: {
      revokedAt: now,
      revokeReason: 'INACTIVITY_TIMEOUT',
    },
  });
}

if (!session || session.revokedAt || session.expiresAt <= now || isIdleExpired) {
  throw new UnauthorizedException('Mobile session expired or revoked.');
}

if (
  lastActivityAt &&
  now.getTime() - lastActivityAt.getTime() >=
    MOBILE_SESSION_ACTIVITY_UPDATE_INTERVAL_MS
) {
  await this.prisma.mobileAuthSession.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
      lastUsedAt: session.lastUsedAt,
    },
    data: { lastUsedAt: now },
  });
}

    if (session.accountType === MobileAuthAccountType.USER) {
      const user = session.user;

      if (
        payload.type !== 'user' ||
        Number(payload.sub) !== session.userID ||
        !user ||
        !user.isActive
      ) {
        throw new UnauthorizedException('Invalid mobile account.');
      }

      const companyIDs = user.userCompanies.map((company) => company.companyID);

      const companyID = user.companyID ?? companyIDs[0] ?? null;

      await this.moduleAccess.assertSessionAllowed(companyID, user.role);

      return {
        ...payload,
        role: user.role,
        companyID: companyID ?? undefined,
        companyIDs,
      };
    }

    const employee = session.employee;
    const employeeID = Number(payload.employeeId ?? payload.sub);

    if (
      payload.type !== 'employee' ||
      employeeID !== session.employeeID ||
      Number(payload.sub) !== employeeID ||
      !employee ||
      employee.isDeleted ||
      !employee.employeeCredentials?.isActive
    ) {
      throw new UnauthorizedException('Invalid employee session.');
    }

    const companyID = employee.companyID ?? null;

    await this.moduleAccess.assertSessionAllowed(companyID, 'EMPLOYEE');

    return {
      ...payload,
      role: 'EMPLOYEE',
      employeeId: employee.id,
      companyID: companyID ?? undefined,
      serviceProviderID: employee.serviceProviderID,
      branchesID: employee.branchesID,
      isCompanyOwner: employee.isCompanyOwner,
    };
  }
}
