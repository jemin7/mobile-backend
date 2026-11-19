import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReceiverKeyGuard } from '../authentication/receiver-key.guard';
import { DevicesService } from './devices.service';
import { SyncDeviceDto } from './dto/device.dto';

@Controller('integration/att-devices')
@UseGuards(ReceiverKeyGuard)
export class DeviceSyncController {
  constructor(private readonly devices: DevicesService) {}

  @Post('sync')
  sync(@Body() dto: SyncDeviceDto) {
    return this.devices.syncDevice(dto);
  }
}
