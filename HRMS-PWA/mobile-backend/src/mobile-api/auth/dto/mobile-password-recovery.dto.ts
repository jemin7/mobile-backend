import { IsString, MinLength } from 'class-validator';

export class MobileForgotPasswordDto {
  @IsString()
  @MinLength(1)
  emailOrMobile: string;
}

export class MobileVerifyForgotPasswordDto {
  @IsString()
  @MinLength(1)
  resetToken: string;

  @IsString()
  @MinLength(6)
  otp: string;

  @IsString()
  @MinLength(8)
  newPassword: string;

  @IsString()
  @MinLength(8)
  confirmPassword: string;
}