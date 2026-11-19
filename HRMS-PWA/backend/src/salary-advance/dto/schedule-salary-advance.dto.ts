import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ScheduleSalaryAdvanceDto {
  @IsString()
  amount: string;

  @IsIn(['ONE_TIME', 'INSTALMENTS'])
  repaymentType: 'ONE_TIME' | 'INSTALMENTS';

  @IsString()
  deductionStartPeriod: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  instalmentCount?: number;

  @IsOptional()
  @IsBoolean()
  approve?: boolean;
}
