import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

export class MobileAttendancePunchDto {
 @IsIn(['CHECK_IN', 'CHECK_OUT'])
checkType: 'CHECK_IN' | 'CHECK_OUT';    

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  browser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  operatingSystem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  clientEventId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  referenceEventId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  punchTime?: string;


    @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  timeProof?: string;
}