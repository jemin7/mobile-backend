import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../../authentication/authentication.module';
import { DevicesModule } from '../../devices/devices.module';
import { RawLogModule } from '../../raw-log/raw-log.module';
import { DahuaController } from './dahua.controller';
import { DahuaService } from './dahua.service';

@Module({
  imports: [AuthenticationModule, DevicesModule, RawLogModule],
  controllers: [DahuaController],
  providers: [DahuaService],
})
export class DahuaModule {}
