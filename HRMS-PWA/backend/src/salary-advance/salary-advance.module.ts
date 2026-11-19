import { Module } from '@nestjs/common';
import { SalaryAdvanceService } from './salary-advance.service';
import { SalaryAdvanceController } from './salary-advance.controller';
import { EmployeeMemoModule } from '../employee-memo/employee-memo.module';
import { SalaryCycleModule } from '../salary-cycle/salary-cycle.module';

@Module({
  imports: [EmployeeMemoModule, SalaryCycleModule],
  controllers: [SalaryAdvanceController],
  providers: [SalaryAdvanceService],
  exports: [SalaryAdvanceService],
})
export class SalaryAdvanceModule {}
