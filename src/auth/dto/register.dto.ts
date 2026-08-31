import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  // @Matches(/@bracu\.ac\.bd$/i, {
  //   message: 'Use your BRAC University email address',
  // })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MaxLength(100)
  name: string;
}
