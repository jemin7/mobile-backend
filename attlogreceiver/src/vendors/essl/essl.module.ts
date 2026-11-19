import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../../authentication/authentication.module';
import { RawLogModule } from '../../raw-log/raw-log.module';
import { EsslController } from './essl.controller';
import { EsslService } from './essl.service';

@Module({
  imports: [AuthenticationModule, RawLogModule],
  controllers: [EsslController],
  providers: [EsslService],
  exports: [EsslService],
})
export class EsslModule {}
