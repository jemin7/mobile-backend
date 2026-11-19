import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { DevicesModule } from '../devices/devices.module';
import { RawLogModule } from '../raw-log/raw-log.module';
import { EsslModule } from '../vendors/essl/essl.module';
import { ZktecoModule } from '../vendors/zkteco/zkteco.module';
import { DeviceRoutingService } from './device-routing.service';
import { GenericDeviceController } from './generic-device.controller';

@Module({
  imports: [AuthenticationModule, DevicesModule, RawLogModule, EsslModule, ZktecoModule],
  controllers: [GenericDeviceController],
  providers: [DeviceRoutingService],
})
export class DeviceRoutingModule {}
