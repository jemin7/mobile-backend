import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyModuleAccessService } from '../../common/company-module-access.service';
import { MobileLoginDto } from './dto/mobile-login.dto';

import { MOBILE_SESSION_IDLE_TIMEOUT_MS } from './mobile-auth.constants';

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthOtpPurpose, MobileAuthAccountType } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';
import { MailService } from '../../mail/mail.service';
import {
  MobileForgotPasswordDto,
  MobileVerifyForgotPasswordDto,
} from './dto/mobile-password-recovery.dto';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;

const FORGOT_PASSWORD_OTP_TTL_MS = 10 * 60 * 1000;
const OTP_SALT_ROUNDS = 10;
@Injectable()
export class MobileAuthService {
  constructor(
    private readonly moduleAccess: CompanyModuleAccessService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

   async login(dto: MobileLoginDto, request: Request) {
    const username = String(dto.username || '').trim();

    let payload: Record<string, any>;
    let userData: Record<string, any>;
    let accountType: MobileAuthAccountType;
    let accountId: number;
    let companyID: number | null;
    let role: string;

    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
      },
      include: {
        company: { select: { companyName: true } },
        branches: { select: { branchName: true } },
        userCompanies: {
          include: {
            company: { select: { id: true, companyName: true } },
          },
        },
      },
    });

    if (user) {
      if (
        !user.isActive ||
        !(await bcrypt.compare(dto.password, user.passwordHash))
      ) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      const userCompanies = user.userCompanies.map((item) => ({
        companyID: item.companyID,
        companyName: item.company?.companyName ?? '',
        isPrimary: item.isPrimary,
      }));

      const companyIDs = userCompanies.map((item) => item.companyID);

      companyID = user.companyID ?? companyIDs[0] ?? null;
      role = user.role;
      accountId = user.id;
      accountType = MobileAuthAccountType.USER;

      payload = {
        sub: user.id,
        username: user.username,
        role,
        type: 'user',
        companyID: companyID ?? undefined,
        companyIDs,
      };

      userData = {
        id: user.id,
        username: user.username,
        role,
        type: 'user',
        serviceProviderID: user.serviceProviderID ?? undefined,
        companyID: companyID ?? undefined,
        activeCompanyID: companyID ?? undefined,
        branchesID: user.branchesID ?? undefined,
        userCompanies,
        companyIDs,
        company: user.company ?? undefined,
        branches: user.branches ?? undefined,
      };
    } else {
      const credentials =
        await this.prisma.employeeCredentials.findFirst({
          where: {
            isActive: true,
            employee: { isDeleted: false },
            OR: [
              { username: { equals: username, mode: 'insensitive' } },
              {
                employee: {
                  is: {
                    employeeID: { equals: username, mode: 'insensitive' },
                  },
                },
              },
              {
                employee: {
                  is: {
                    personalEmail: { equals: username, mode: 'insensitive' },
                  },
                },
              },
              {
                employee: {
                  is: {
                    businessEmail: { equals: username, mode: 'insensitive' },
                  },
                },
              },
            ],
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeFirstName: true,
                employeeLastName: true,
                employeeID: true,
                businessEmail: true,
                isCompanyOwner: true,
                ownerTitle: true,
                allowCreateTaskOnMobile: true,
                pwaShowLeaveBalance: true,
                pwaShowLoanAdvances: true,
                departments: {
                  select: { departmentName: true },
                },
                designations: {
                  select: { designation: true },
                },
                company: {
                  select: { companyName: true },
                },
                branches: {
                  select: { branchName: true },
                },
              },
            },
          },
        });

      if (
        !credentials ||
        !(await this.passwordMatches(dto.password, credentials.password))
      ) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      const employee = credentials.employee;

      accountId = credentials.employeeID;
      accountType = MobileAuthAccountType.EMPLOYEE;
      companyID = credentials.companyID ?? null;
      role = 'EMPLOYEE';

      payload = {
        sub: accountId,
        username: credentials.username,
        role,
        type: 'employee',
        employeeId: accountId,
        serviceProviderID: credentials.serviceProviderID,
        companyID,
        branchesID: credentials.branchesID,
        isCompanyOwner: !!employee.isCompanyOwner,
      };

      userData = {
        id: accountId,
        username: credentials.username,
        role,
        type: 'employee',
        mustChangePassword: credentials.mustChangePassword,
        isCompanyOwner: !!employee.isCompanyOwner,
        ownerTitle: employee.ownerTitle ?? null,
        employee: {
          id: employee.id,
          employeeID: employee.employeeID,
          firstName: employee.employeeFirstName,
          lastName: employee.employeeLastName,
          email: employee.businessEmail,
          isCompanyOwner: !!employee.isCompanyOwner,
          ownerTitle: employee.ownerTitle ?? null,
          allowCreateTaskOnMobile:
            employee.allowCreateTaskOnMobile === true,
          pwaShowLeaveBalance: employee.pwaShowLeaveBalance !== false,
          pwaShowLoanAdvances: employee.pwaShowLoanAdvances !== false,
          department: employee.departments?.departmentName,
          designation: employee.designations?.designation,
          company: employee.company?.companyName,
          branch: employee.branches?.branchName,
        },
        employeeCredentials: {
          mustChangePassword: credentials.mustChangePassword,
        },
        serviceProviderID: credentials.serviceProviderID,
        companyID: credentials.companyID,
        branchesID: credentials.branchesID,
      };
    }

    await this.moduleAccess.assertLoginAllowed(companyID, role);

    const refreshToken = randomBytes(48).toString('base64url');
    const now = new Date();

    const refreshExpiresAt = new Date(
      now.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const session = await this.prisma.mobileAuthSession.create({
      data: {
        accountType,
        userID:
          accountType === MobileAuthAccountType.USER ? accountId : null,
        employeeID:
          accountType === MobileAuthAccountType.EMPLOYEE ? accountId : null,
        deviceName: dto.deviceName?.trim() || null,
        deviceId: dto.deviceId?.trim() || null,
        platform: dto.platform || null,
        ipAddress: request.ip?.slice(0, 64) || null,
        userAgent: request.get('user-agent')?.slice(0, 512) || null,
        lastUsedAt: now,
        expiresAt: refreshExpiresAt,
        refreshTokens: {
          create: {
            tokenHash: this.hashToken(refreshToken),
            expiresAt: refreshExpiresAt,
          },
        },
      },
    });

    const accessToken = await this.jwt.signAsync(
      {
        ...payload,
        client: 'mobile',
        sid: session.id,
      },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: userData,
    };
  }

  private async passwordMatches(plain: string, hash: string): Promise<boolean> {
    if (await bcrypt.compare(plain, hash)) return true;

    const digits = String(plain || '').replace(/\D/g, '');
    return !!digits && digits !== plain && bcrypt.compare(digits, hash);
  }


    private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    if (local.length <= 2) return `${local[0] || '*'}xxx@${domain}`;
    return `${local[0]}xxx${local[local.length - 1]}@${domain}`;
  }

  async forgotPassword(dto: MobileForgotPasswordDto) {
    const identifier = String(dto.emailOrMobile || '').trim();

    if (!identifier) {
      throw new BadRequestException('Email or mobile number is required.');
    }

    let employee: any = null;

    if (identifier.includes('@')) {
      employee = await this.prisma.manageEmployee.findFirst({
        where: {
          isDeleted: false,
          OR: [
            { personalEmail: { equals: identifier, mode: 'insensitive' } },
            { businessEmail: { equals: identifier, mode: 'insensitive' } },
            {
              employeeCredentials: {
                is: {
                  username: { equals: identifier, mode: 'insensitive' },
                },
              },
            },
          ],
        },
        include: { employeeCredentials: true },
      });
    } else {
      const digits = identifier.replace(/\D/g, '');

      const candidates = await this.prisma.manageEmployee.findMany({
        where: {
          isDeleted: false,
          OR: [
            { personalPhoneNo: identifier },
            ...(digits ? [{ personalPhoneNo: { contains: digits } }] : []),
          ],
        },
        include: { employeeCredentials: true },
      });

      const matches = candidates.filter((row) => {
        const rowDigits = String(row.personalPhoneNo || '').replace(/\D/g, '');
        return rowDigits === digits ||
          String(row.personalPhoneNo || '').trim() === identifier;
      });

      employee = matches.length === 1
        ? matches[0]
        : matches.find((row) =>
            !!(
              row.personalEmail ||
              row.businessEmail ||
              row.employeeCredentials?.username?.includes('@')
            ),
          ) || matches[0] || null;
    }

    if (!employee || !employee.employeeCredentials?.isActive) {
      throw new BadRequestException(
        'Wrong email address or email not found. Contact your administrator.',
      );
    }

    const email =
      String(employee.personalEmail || '').trim() ||
      String(employee.businessEmail || '').trim() ||
      (
        String(employee.employeeCredentials.username || '').includes('@')
          ? String(employee.employeeCredentials.username).trim()
          : ''
      );

    if (!email || !this.mail.isConfigured()) {
      throw new BadRequestException(
        'Email could not be sent. Contact your administrator.',
      );
    }

    const otp = String(randomInt(100000, 1000000));
    const pendingToken = randomBytes(32).toString('hex');
    const codeHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
    const now = new Date();

    const created = await this.prisma.authOtp.create({
      data: {
        purpose: AuthOtpPurpose.FORGOT_PASSWORD,
        identifier: `employee:${employee.id}`,
        codeHash,
        pendingToken,
        payload: JSON.stringify({ employeeID: employee.id }),
        expiresAt: new Date(now.getTime() + FORGOT_PASSWORD_OTP_TTL_MS),
      },
    });

    const sent = await this.mail.sendRawEmail({
      to: email,
      subject: 'EN-Time HR password reset OTP',
      html:
        '<p>Use this code to reset your EN-Time HR password.</p>' +
        `<p style="font-size:22px;letter-spacing:4px;font-weight:700">${otp}</p>` +
        '<p>This code expires in 10 minutes.</p>',
      text: `Use this code to reset your EN-Time HR password.\n\n${otp}\n\nThis code expires in 10 minutes.`,
    });

    if (!sent) {
      await this.prisma.authOtp.delete({
        where: { id: created.id },
      }).catch(() => undefined);

      throw new BadRequestException(
        'Email could not be sent. Contact your administrator.',
      );
    }

    await this.prisma.authOtp.updateMany({
      where: {
        purpose: AuthOtpPurpose.FORGOT_PASSWORD,
        identifier: `employee:${employee.id}`,
        consumedAt: null,
        id: { lt: created.id },
      },
      data: { consumedAt: now },
    });

    return {
      message: `OTP sent to ${this.maskEmail(email)}`,
      resetToken: pendingToken,
      maskedEmail: this.maskEmail(email),
    };
  }

  async verifyForgotPassword(dto: MobileVerifyForgotPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match.',
      );
    }

    const password = String(dto.newPassword || '');
    const failedRules = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ];

    if (failedRules.some((valid) => !valid)) {
      throw new BadRequestException(
        'Password must have at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.',
      );
    }

    const row = await this.prisma.authOtp.findUnique({
      where: {
        pendingToken: String(dto.resetToken || '').trim(),
      },
    });

    if (
      !row ||
      row.purpose !== AuthOtpPurpose.FORGOT_PASSWORD ||
      row.consumedAt ||
      row.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const validOtp = await bcrypt.compare(
      String(dto.otp || '').trim(),
      row.codeHash,
    );

    if (!validOtp) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    let employeeID: number;

    try {
      const payload = row.payload ? JSON.parse(row.payload) : null;
      employeeID = Number(payload?.employeeID);
    } catch {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    if (!Number.isSafeInteger(employeeID) || employeeID <= 0) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimedOtp = await tx.authOtp.updateMany({
        where: {
          id: row.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (claimedOtp.count !== 1) return false;

      const updatedCredentials =
        await tx.employeeCredentials.updateMany({
          where: {
            employeeID,
            isActive: true,
          },
          data: {
            password: hashedPassword,
            mustChangePassword: false,
            passwordChangedAt: now,
          },
        });

      if (updatedCredentials.count !== 1) {
        throw new UnauthorizedException('Employee account is unavailable.');
      }

      await tx.mobileAuthSession.updateMany({
        where: {
          employeeID,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: 'PASSWORD_RESET',
        },
      });

      return true;
    });

    if (!updated) {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }

    return {
      message: 'Password reset successfully. You can now log in.',
    };
  }
  
  async refresh(rawRefreshToken: string) {
    const now = new Date();
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.mobileRefreshToken.findUnique({
      where: { tokenHash },
      include: {
        session: {
          include: {
            user: {
              include: {
                userCompanies: {
                  include: {
                    company: {
                      select: { id: true, companyName: true },
                    },
                  },
                },
              },
            },
            employee: {
              include: {
                employeeCredentials: {
                  select: { isActive: true, username: true },
                },
                company: {
                  select: { id: true, companyName: true },
                },
                branches: {
                  select: { id: true, branchName: true },
                },
                departments: {
                  select: { id: true, departmentName: true },
                },
                designations: {
                  select: { id: true, designation: true },
                },
              },
            },
          },
        },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const session = stored.session;

    if (stored.usedAt) {
      await this.prisma.mobileAuthSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokeReason: 'REFRESH_TOKEN_REUSE',
        },
      });

      throw new UnauthorizedException('Refresh token reuse detected.');
    }

    const lastActivityAt = session.lastUsedAt ?? session.createdAt;

    if (
      now.getTime() - lastActivityAt.getTime() >=
      MOBILE_SESSION_IDLE_TIMEOUT_MS
    ) {
      await this.prisma.mobileAuthSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokeReason: 'INACTIVITY_TIMEOUT',
        },
      });

      throw new UnauthorizedException(
        'Mobile session expired due to inactivity.',
      );
    }

    if (
      stored.expiresAt <= now ||
      session.expiresAt <= now ||
      session.revokedAt
    ) {
      throw new UnauthorizedException('Mobile session expired.');
    }

    let payload: Record<string, any>;
    let companyID: number | null = null;
    let role: string;

    if (session.accountType === MobileAuthAccountType.USER) {
      const user = session.user;

      if (!user || !user.isActive) {
        await this.prisma.mobileAuthSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now, revokeReason: 'ACCOUNT_DISABLED' },
        });

        throw new UnauthorizedException('Account is disabled.');
      }

      const companyIDs = user.userCompanies.map((item) => item.companyID);
      companyID = user.companyID ?? companyIDs[0] ?? null;
      role = user.role;

      payload = {
        sub: user.id,
        username: user.username,
        role,
        type: 'user',
        companyID: companyID ?? undefined,
        companyIDs,
      };
    } else {
      const employee = session.employee;

      if (
        !employee ||
        employee.isDeleted ||
        !employee.employeeCredentials?.isActive
      ) {
        await this.prisma.mobileAuthSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now, revokeReason: 'ACCOUNT_DISABLED' },
        });

        throw new UnauthorizedException('Employee account is disabled.');
      }

      companyID = employee.companyID ?? null;
      role = 'EMPLOYEE';

      payload = {
        sub: employee.id,
        username: employee.employeeCredentials.username,
        role,
        type: 'employee',
        employeeId: employee.id,
        serviceProviderID: employee.serviceProviderID,
        companyID: employee.companyID,
        branchesID: employee.branchesID,
        isCompanyOwner: employee.isCompanyOwner,
      };
    }

    await this.moduleAccess.assertSessionAllowed(companyID, role);

    const newRefreshToken = randomBytes(48).toString('base64url');

    const rotated = await this.prisma.$transaction(async (tx) => {
      const activeSession = await tx.mobileAuthSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { lastUsedAt: now },
      });

      if (activeSession.count !== 1) return false;

      const consumed = await tx.mobileRefreshToken.updateMany({
        where: {
          id: stored.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumed.count !== 1) return false;

      await tx.mobileRefreshToken.create({
        data: {
          sessionID: session.id,
          tokenHash: this.hashToken(newRefreshToken),
          expiresAt: session.expiresAt,
        },
      });

      return true;
    });

    if (!rotated) {
      await this.prisma.mobileAuthSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokeReason: 'REFRESH_TOKEN_REUSE',
        },
      });

      throw new UnauthorizedException('Refresh token is no longer valid.');
    }

    const accessToken = await this.jwt.signAsync(
      {
        ...payload,
        client: 'mobile',
        sid: session.id,
      },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.mobileRefreshToken.findUnique({
      where: { tokenHash },
      select: { sessionID: true },
    });

    if (stored) {
      await this.prisma.mobileAuthSession.updateMany({
        where: {
          id: stored.sessionID,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: 'LOGOUT',
        },
      });
    }

    return { ok: true };
  }
}
