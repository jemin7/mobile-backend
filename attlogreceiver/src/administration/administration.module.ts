import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { PunchProcessingModule } from '../punch-processing/punch-processing.module';
import { RawLogModule } from '../raw-log/raw-log.module';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';

@Module({
  imports: [AuthenticationModule, RawLogModule, PunchProcessingModule],
  controllers: [AdministrationController],
  providers: [AdministrationService],
})
export class AdministrationModule {}
