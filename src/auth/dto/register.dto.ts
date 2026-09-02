import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Matches(/@g\.bracu\.ac\.bd$/i, {
    message: 'Use your BRAC University student email address (@g.bracu.ac.bd)',
  })
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MaxLength(100)
  name: string;
}
