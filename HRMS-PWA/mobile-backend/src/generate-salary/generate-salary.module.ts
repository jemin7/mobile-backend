import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { SalaryCycleModule } from '../salary-cycle/salary-cycle.module';
import { SalaryAdvanceModule } from '../salary-advance/salary-advance.module';
import { GenerateSalaryService } from './generate-salary.service';
import { GenerateSalaryController } from './generate-salary.controller';
@Module({
  imports: [PrismaModule, PushNotificationsModule, MailModule, SalaryCycleModule, SalaryAdvanceModule],
  controllers: [GenerateSalaryController],
  providers: [GenerateSalaryService],
})
export class GenerateSalaryModule {}
