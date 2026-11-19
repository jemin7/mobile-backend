import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { DevicesModule } from '../devices/devices.module';
import { DistributionService } from './distribution.service';
import { PunchProcessingController } from './punch-processing.controller';
import { PunchProcessingService } from './punch-processing.service';
import { PunchProcessingWorker } from './punch-processing.worker';

@Module({
  imports: [AuthenticationModule, DevicesModule],
  controllers: [PunchProcessingController],
  providers: [PunchProcessingService, DistributionService, PunchProcessingWorker],
  exports: [PunchProcessingService, DistributionService],
})
export class PunchProcessingModule {}
