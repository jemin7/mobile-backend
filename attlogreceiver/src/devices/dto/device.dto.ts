import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { VENDORS } from '../../common/enums';

export class CreateDeviceDto {
  @IsIn(VENDORS)
  vendor!: string;

  @IsString()
  @MaxLength(150)
  device_sn!: string;

  @IsString()
  @MaxLength(150)
  device_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firmware_version?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  device_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firmware_version?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateDeviceStatusDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status!: number;
}

export class SyncDeviceDto {
  @IsString()
  @MaxLength(100)
  source_device_id!: string;

  @IsOptional()
  @IsBoolean()
  deleted?: boolean;

  @ValidateIf((dto: SyncDeviceDto) => dto.deleted !== true)
  @IsIn(VENDORS)
  vendor?: string;

  @ValidateIf((dto: SyncDeviceDto) => dto.deleted !== true)
  @IsString()
  @MaxLength(150)
  device_sn?: string;

  @ValidateIf((dto: SyncDeviceDto) => dto.deleted !== true)
  @IsString()
  @MaxLength(150)
  device_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;
}

export class ListDevicesQueryDto {
  @IsOptional()
  @IsIn(VENDORS)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  device_sn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
