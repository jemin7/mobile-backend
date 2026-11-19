import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { DeviceSyncController } from './device-sync.controller';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [AuthenticationModule],
  controllers: [DevicesController, DeviceSyncController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
