import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LOG_TYPES, PROCESSING_STATUSES, VENDORS } from '../../common/enums';

export class RawLogQueryDto {
  @IsOptional()
  @IsIn(VENDORS)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  device_sn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  user_id?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;

  @IsOptional()
  @IsIn(LOG_TYPES)
  log_type?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  is_valid?: boolean;

  @IsOptional()
  @IsIn(PROCESSING_STATUSES)
  processing_status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  verification_reason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
