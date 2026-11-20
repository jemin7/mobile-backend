import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Prisma } from '@prisma/client';
import { reverseGeocode } from '../common/reverse-geocode';
import { ReceiverClientService } from '../receiver-client/receiver-client.service';

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private receiver: ReceiverClientService,
  ) {}

  private async resolveLocationFields(
    latitude?: number | null,
    longitude?: number | null,
  ): Promise<Pick<Prisma.DevicesCreateInput, 'latitude' | 'longitude' | 'address'>> {
    if (latitude == null || longitude == null) {
      return { latitude: null, longitude: null, address: null };
    }
    const address = await reverseGeocode(latitude, longitude);
    return { latitude, longitude, address };
  }

  async create(dto: CreateDeviceDto) {
    const { serviceProviderID, companyID, branchesID, latitude, longitude, ...rest } = dto;
    const location = await this.resolveLocationFields(latitude, longitude);

    const data: Prisma.DevicesCreateInput = {
      ...rest,
      ...location,
      ...(serviceProviderID != null ? { serviceProviderID } : {}),
      ...(companyID != null
        ? { company: { connect: { id: companyID } } }
        : {}),
      ...(branchesID != null
        ? { branches: { connect: { id: branchesID } } }
        : {}),
    };

    const created = await this.prisma.devices.create({
      data,
      include: { company: true, branches: true },
    });
    await this.receiver.syncDevice(created);
    return created;
  }

  findAll() {
    return this.prisma.devices.findMany({
      orderBy: { createdAt: 'desc' },
      include: { company: true, branches: true },
    });
  }

  findOne(id: number) {
    return this.prisma.devices.findUnique({
      where: { id },
      include: { company: true, branches: true },
    });
  }

  async update(id: number, dto: UpdateDeviceDto) {
    const { serviceProviderID, companyID, branchesID, authTypes, latitude, longitude, ...rest } =
      dto;

    let locationPatch: Prisma.DevicesUpdateInput = {};
    if (latitude !== undefined || longitude !== undefined) {
      const existing = await this.prisma.devices.findUnique({
        where: { id },
        select: { latitude: true, longitude: true },
      });
      const lat = latitude !== undefined ? latitude : existing?.latitude ?? null;
      const lng = longitude !== undefined ? longitude : existing?.longitude ?? null;
      locationPatch = await this.resolveLocationFields(lat, lng);
    }

    const relationData: Prisma.DevicesUpdateInput = {
      ...rest,
      ...locationPatch,
      ...(authTypes !== undefined ? { authTypes } : {}),
      ...(serviceProviderID !== undefined
        ? { serviceProviderID: serviceProviderID ?? null }
        : {}),
      ...(companyID !== undefined
        ? companyID == null
          ? { company: { disconnect: true } }
          : { company: { connect: { id: companyID } } }
        : {}),
      ...(branchesID !== undefined
        ? branchesID == null
          ? { branches: { disconnect: true } }
          : { branches: { connect: { id: branchesID } } }
        : {}),
    };

    const updated = await this.prisma.devices.update({
      where: { id },
      data: relationData,
      include: { company: true, branches: true },
    });
    await this.receiver.syncDevice(updated);
    return updated;
  }

  async remove(id: number) {
    const removed = await this.prisma.devices.delete({ where: { id } });
    await this.receiver.deactivateDevice(id, removed.deviceSN);
    return removed;
  }

  resolveAddress(latitude: number, longitude: number) {
    return reverseGeocode(latitude, longitude);
  }
}
