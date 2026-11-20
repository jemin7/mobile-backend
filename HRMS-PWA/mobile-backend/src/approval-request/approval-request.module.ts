import {
  Module,
} from '@nestjs/common';

import { ApprovalRequestController } from './approval-request.controller';
import { ApprovalRequestService } from './approval-request.service';
import { EmpLeaveBalanceModule } from '../emp-leave-balance/emp-leave-balance.module';

@Module({
  imports: [EmpLeaveBalanceModule],
  controllers: [
    ApprovalRequestController,
  ],

  providers: [
    ApprovalRequestService,
  ],

  exports: [
    ApprovalRequestService,
  ],
})
export class ApprovalRequestModule {}