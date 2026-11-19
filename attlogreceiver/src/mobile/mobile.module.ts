import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { RawLogModule } from '../raw-log/raw-log.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [AuthenticationModule, RawLogModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
