import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PullPunchesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @IsString()
  export?: string;
}

export class MarkExportedDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  ids!: number[];
}

export class ReprocessDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  ids?: number[];

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  device_sn?: string;

  @IsOptional()
  @IsString()
  from_date?: string;

  @IsOptional()
  @IsString()
  to_date?: string;
}
