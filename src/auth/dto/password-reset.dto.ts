import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must contain exactly 6 digits' })
  otp: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
