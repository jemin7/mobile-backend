import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankDetailsDto } from './dto/create-bank-detail.dto';
import { UpdateBankDetailsDto } from './dto/update-bank-detail.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BankDetailsService {
  constructor(private prisma: PrismaService) {}

  // CREATE (branches is required: must connect)
  create(dto: CreateBankDetailsDto) {
    const { serviceProviderID, companyID, branchesID, ...rest } = dto;

    const data: Prisma.BankDetailsCreateInput = {
      // scalar fields
      bankName: rest.bankName ?? null,
      bankBranchName: rest.bankBranchName ?? null,
      accountNo: rest.accountNo ?? null,
      ifscCode: rest.ifscCode ?? null,

      ...(branchesID != null ? { branches: { connect: { id: branchesID } } } : {}),

      // optional relations
      ...(serviceProviderID != null ? { serviceProviderID } : {}),
      ...(companyID != null
        ? { company: { connect: { id: companyID } } }
        : {}),
    };

    return this.prisma.bankDetails.create({
      data,
      include: { company: true, branches: true },
    });
  }

  findAll() {
    return this.prisma.bankDetails.findMany({
      include: { company: true, branches: true },
    });
  }

  findOne(id: number) {
    return this.prisma.bankDetails.findUnique({
      where: { id },
      include: { company: true, branches: true },
    });
  }

  // UPDATE (cannot disconnect branches; may connect to a new one)
  async update(id: number, dto: UpdateBankDetailsDto) {
    const { serviceProviderID, companyID, branchesID, ...rest } = dto;
    const current =
      branchesID === null
        ? await this.prisma.bankDetails.findUnique({
            where: { id },
            select: { branchesID: true },
          })
        : null;

    const data: Prisma.BankDetailsUpdateInput = {
      // scalar updates
      bankName: rest.bankName ?? null,
      bankBranchName: rest.bankBranchName ?? null,
      accountNo: rest.accountNo ?? null,
      ifscCode: rest.ifscCode ?? null,

      // optional relations: allow connect/disconnect for optional ones
      ...(serviceProviderID !== undefined
        ? { serviceProviderID: serviceProviderID ?? null }
        : {}),
      ...(companyID !== undefined
        ? companyID == null
          ? { company: { disconnect: true } }
          : { company: { connect: { id: companyID } } }
        : {}),

      ...(branchesID != null
        ? { branches: { connect: { id: branchesID } } }
        : current?.branchesID != null
          ? { branches: { disconnect: true } }
          : {}),
    };

    return this.prisma.bankDetails.update({
      where: { id },
      data,
      include: { company: true, branches: true },
    });
  }

  remove(id: number) {
    return this.prisma.bankDetails.delete({ where: { id } });
  }
}
