import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(employeeId: number) {
    const employee = await this.prisma.manageEmployee.findFirst({
      where: {
        id: employeeId,
        isDeleted: false,
      },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
        businessEmail: true,
        personalEmail: true,
        businessPhoneNo: true,
        personalPhoneNo: true,
        branches: {
          select: { branchName: true },
        },
        departments: {
          select: { departmentName: true },
        },
        designations: {
          select: { designation: true },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    return {
      id: employee.id,
      employeeID: employee.employeeID,
      employeeFirstName: employee.employeeFirstName,
      employeeLastName: employee.employeeLastName,
      employeePhotoUrl: employee.employeePhotoUrl,
      businessEmail: employee.businessEmail,
      personalEmail: employee.personalEmail,
      businessPhoneNo: employee.businessPhoneNo,
      personalPhoneNo: employee.personalPhoneNo,
      branch: employee.branches?.branchName ?? null,
      department: employee.departments?.departmentName ?? null,
      designation: employee.designations?.designation ?? null,
    };
  }

  async updateMyProfilePhoto(employeeId: number, photoUrl: string) {
    const result = await this.prisma.manageEmployee.updateMany({
      where: {
        id: employeeId,
        isDeleted: false,
      },
      data: {
        employeePhotoUrl: photoUrl,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Employee profile not found.');
    }

    return { employeePhotoUrl: photoUrl };
  }
}