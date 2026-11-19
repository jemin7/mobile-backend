import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../authentication/admin-auth.guard';
import { DevicesService } from './devices.service';
import {
  CreateDeviceDto,
  ListDevicesQueryDto,
  UpdateDeviceDto,
  UpdateDeviceStatusDto,
} from './dto/device.dto';

@Controller('att-devices')
@UseGuards(AdminAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.devices.create(dto);
  }

  @Get()
  list(@Query() query: ListDevicesQueryDto) {
    return this.devices.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.devices.get(BigInt(id));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(BigInt(id), dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeviceStatusDto) {
    return this.devices.updateStatus(BigInt(id), dto.status);
  }
}
