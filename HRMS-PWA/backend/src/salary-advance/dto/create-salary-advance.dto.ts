import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSalaryAdvanceDto {
  @IsOptional() @IsInt()
  serviceProviderID?: number;

  @IsOptional() @IsInt()
  companyID?: number;

  @IsOptional() @IsInt()
  branchesID?: number;

  @IsOptional() @IsInt()
  manageEmployeeID?: number;

  @IsOptional() @IsString()
  previousAdvancesDue?: string;

  @IsOptional() @IsString()
  advanceAmount?: string;

  @IsOptional() @IsString()
  reason?: string;

  @IsOptional() @IsIn(['SALARY_ADVANCE', 'EMPLOYEE_LOAN'])
  requestType?: 'SALARY_ADVANCE' | 'EMPLOYEE_LOAN';

  @IsOptional() @IsString()
  approvedAmount?: string;

  @IsOptional() @IsIn(['ONE_TIME', 'INSTALMENTS'])
  repaymentType?: 'ONE_TIME' | 'INSTALMENTS';

  @IsOptional() @IsString()
  deductionStartPeriod?: string;

  @IsOptional() @IsInt() @Min(1)
  instalmentCount?: number;

  @IsOptional() @IsString()
  instalmentAmount?: string;

  @IsOptional() @IsString()
  disbursedAmount?: string;

  @IsOptional() @IsString()
  paymentReference?: string;

  @IsOptional() @IsString()
  recoveredAmount?: string;

  @IsOptional() @IsString()
  outstandingBalance?: string;

  @IsOptional() @IsString()
  repaymentTanure?: string;

  @IsOptional() @IsString()
  status?: string;
}
