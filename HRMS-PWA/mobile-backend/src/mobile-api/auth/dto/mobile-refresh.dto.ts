import { IsString, MaxLength, MinLength } from 'class-validator';

export class MobileRefreshDto {
  @IsString()
  @MinLength(32)
  @MaxLength(200)
  refreshToken: string;
}
