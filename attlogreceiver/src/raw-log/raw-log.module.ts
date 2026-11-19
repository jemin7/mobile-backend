import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { DevicesModule } from '../devices/devices.module';
import { RawLogController } from './raw-log.controller';
import { RawLogService } from './raw-log.service';

@Module({
  imports: [AuthenticationModule, DevicesModule],
  controllers: [RawLogController],
  providers: [RawLogService],
  exports: [RawLogService],
})
export class RawLogModule {}
