import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DisburseSalaryAdvanceDto {
  @IsString()
  disbursedAmount: string;

  @IsDateString()
  disbursementDate: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}
