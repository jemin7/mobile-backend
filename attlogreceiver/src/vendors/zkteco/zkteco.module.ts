import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../../authentication/authentication.module';
import { RawLogModule } from '../../raw-log/raw-log.module';
import { ZktecoController } from './zkteco.controller';
import { ZktecoService } from './zkteco.service';

@Module({
  imports: [AuthenticationModule, RawLogModule],
  controllers: [ZktecoController],
  providers: [ZktecoService],
  exports: [ZktecoService],
})
export class ZktecoModule {}
