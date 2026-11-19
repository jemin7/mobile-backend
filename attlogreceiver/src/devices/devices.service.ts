import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttDevice, Prisma } from '@prisma/client';
import { Vendor } from '../common/enums';
import { PrismaService } from '../database/prisma.service';
import {
  CreateDeviceDto,
  ListDevicesQueryDto,
  SyncDeviceDto,
  UpdateDeviceDto,
} from './dto/device.dto';

export type DeviceVerification = {
  verified: boolean;
  reason: string | null;
};

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeviceDto) {
    try {
      const device = await this.prisma.attDevice.create({
        data: {
          vendor: dto.vendor,
          deviceSn: dto.device_sn.trim(),
          deviceName: dto.device_name.trim(),
          deviceModel: dto.device_model?.trim() || null,
          firmwareVersion: dto.firmware_version?.trim() || null,
          status: dto.status ?? 1,
          metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      await this.audit('register_device', device.id, { device_sn: device.deviceSn });
      return { success: true, data: this.present(device) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('duplicate_device');
      }
      throw error;
    }
  }

  async list(query: ListDevicesQueryDto) {
    const limit = query.limit ?? 100;
    const afterId = query.after_id ?? 0;
    const where: Prisma.AttDeviceWhereInput = {
      id: { gt: afterId },
      ...(query.vendor ? { vendor: query.vendor } : {}),
      ...(query.device_sn ? { deviceSn: query.device_sn } : {}),
      ...(query.status === undefined ? {} : { status: query.status }),
    };
    const rows = await this.prisma.attDevice.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map((row) => this.present(row));
    const nextAfterId = data.length > 0 ? data[data.length - 1].id : afterId;
    return {
      success: true,
      data,
      pagination: { after_id: afterId, next_after_id: nextAfterId, limit, has_more: hasMore },
    };
  }

  async get(id: bigint) {
    const device = await this.prisma.attDevice.findUnique({ where: { id } });
    if (!device) {
      throw new NotFoundException('device_not_found');
    }
    return { success: true, data: this.present(device) };
  }

  async update(id: bigint, dto: UpdateDeviceDto) {
    const existing = await this.prisma.attDevice.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('device_not_found');
    }
    try {
      const device = await this.prisma.attDevice.update({
        where: { id },
        data: {
          deviceName: dto.device_name?.trim(),
          deviceModel: dto.device_model === undefined ? undefined : dto.device_model.trim() || null,
          firmwareVersion:
            dto.firmware_version === undefined ? undefined : dto.firmware_version.trim() || null,
          status: dto.status,
          metadata:
            dto.metadata === undefined ? undefined : (dto.metadata as Prisma.InputJsonValue),
        },
      });
      await this.audit('update_device', device.id, { status: device.status });
      return { success: true, data: this.present(device) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('duplicate_device');
      }
      throw error;
    }
  }

  async updateStatus(id: bigint, status: number) {
    return this.update(id, { status });
  }

  async syncDevice(dto: SyncDeviceDto) {
    const sourceDeviceId = dto.source_device_id.trim();
    if (!sourceDeviceId) {
      throw new BadRequestException('source_device_id_required');
    }
    const existing = await this.findSyncTarget(sourceDeviceId, dto);
    if (dto.deleted === true) {
      if (!existing) {
        return { success: true, action: 'not_found', data: null };
      }
      const device = await this.applySync(existing, sourceDeviceId, dto, 0);
      return { success: true, action: 'deactivated', data: this.present(device) };
    }
    const vendor = dto.vendor?.trim();
    const deviceSn = dto.device_sn?.trim();
    const deviceName = dto.device_name?.trim();
    if (!vendor || !deviceSn || !deviceName) {
      throw new BadRequestException('device_fields_required');
    }
    if (existing) {
      const device = await this.applySync(existing, sourceDeviceId, dto, dto.status ?? existing.status);
      return { success: true, action: 'updated', data: this.present(device) };
    }
    try {
      const device = await this.prisma.attDevice.create({
        data: {
          sourceDeviceId,
          vendor,
          deviceSn,
          deviceName,
          deviceModel: dto.device_model?.trim() || null,
          status: dto.status ?? 1,
        },
      });
      await this.audit('sync_device', device.id, { action: 'created', source_device_id: sourceDeviceId }, 'sync');
      return { success: true, action: 'created', data: this.present(device) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.findSyncTarget(sourceDeviceId, dto);
        if (!raced) {
          throw new ConflictException('duplicate_device');
        }
        const device = await this.applySync(raced, sourceDeviceId, dto, dto.status ?? raced.status);
        return { success: true, action: 'updated', data: this.present(device) };
      }
      throw error;
    }
  }

  async findBySerial(deviceSn: string): Promise<AttDevice[]> {
    return this.prisma.attDevice.findMany({ where: { deviceSn } });
  }

  async findByDedicatedIp(ip: string): Promise<AttDevice[]> {
    if (!ip) {
      return [];
    }
    const rows = await this.prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM att_devices WHERE metadata->>'dedicated_ip' = ${ip}
    `;
    if (rows.length === 0) {
      return [];
    }
    return this.prisma.attDevice.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
  }

  async verify(input: { vendor: Vendor; deviceSn: string }): Promise<DeviceVerification> {
    if (!input.deviceSn || input.deviceSn === 'UNKNOWN') {
      return { verified: false, reason: 'missing_serial' };
    }
    const device = await this.prisma.attDevice.findUnique({
      where: { deviceSn: input.deviceSn },
    });
    if (!device) {
      return { verified: false, reason: 'device_not_registered' };
    }
    if (device.vendor !== input.vendor) {
      return { verified: false, reason: 'vendor_mismatch' };
    }
    if (device.status !== 1) {
      return { verified: false, reason: 'device_inactive' };
    }
    return { verified: true, reason: null };
  }

  async findSoleActive(vendor: Vendor): Promise<AttDevice | null> {
    const devices = await this.prisma.attDevice.findMany({
      where: { vendor, status: 1 },
      take: 2,
    });
    return devices.length === 1 ? devices[0] : null;
  }

  present(device: AttDevice) {
    return {
      id: device.id,
      vendor: device.vendor,
      device_sn: device.deviceSn,
      device_name: device.deviceName,
      device_model: device.deviceModel,
      firmware_version: device.firmwareVersion,
      source_device_id: device.sourceDeviceId,
      status: device.status,
      metadata: device.metadata,
      created_at: device.createdAt,
      updated_at: device.updatedAt,
    };
  }

  private async findSyncTarget(sourceDeviceId: string, dto: SyncDeviceDto) {
    const bySource = await this.prisma.attDevice.findFirst({
      where: { sourceDeviceId },
    });
    if (bySource) {
      return bySource;
    }
    const vendor = dto.vendor?.trim();
    const deviceSn = dto.device_sn?.trim();
    if (!vendor || !deviceSn) {
      return null;
    }
    return this.prisma.attDevice.findFirst({
      where: { vendor, deviceSn, sourceDeviceId: null },
    });
  }

  private async applySync(existing: AttDevice, sourceDeviceId: string, dto: SyncDeviceDto, status: number) {
    try {
      const device = await this.prisma.attDevice.update({
        where: { id: existing.id },
        data: {
          sourceDeviceId,
          vendor: dto.vendor?.trim() || existing.vendor,
          deviceSn: dto.device_sn?.trim() || existing.deviceSn,
          deviceName: dto.device_name?.trim() || existing.deviceName,
          deviceModel:
            dto.device_model === undefined ? existing.deviceModel : dto.device_model.trim() || null,
          status,
        },
      });
      await this.audit(
        'sync_device',
        device.id,
        { action: dto.deleted ? 'deactivated' : 'updated', source_device_id: sourceDeviceId, status },
        'sync',
      );
      return device;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('duplicate_device');
      }
      throw error;
    }
  }

  private async audit(action: string, id: bigint, details: Prisma.InputJsonValue, actor = 'admin') {
    await this.prisma.adminAuditLog.create({
      data: {
        action,
        actor,
        targetType: 'att_devices',
        targetId: id.toString(),
        details,
      },
    });
  }
}
