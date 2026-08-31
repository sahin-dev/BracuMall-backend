import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  legalName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @IsIn(['female', 'male', 'non_binary', 'prefer_not_to_say'])
  gender: string;

  @IsString()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message: 'phoneNumber must be a valid Bangladeshi mobile number',
  })
  phoneNumber: string;

  @IsString()
  @Matches(/^(?:\+?88)?01[3-9]\d{8}$/, {
    message: 'whatsappNumber must be a valid Bangladeshi mobile number',
  })
  whatsappNumber: string;

  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  department: string;

  @IsString()
  @Matches(/^(?:\d{10}|\d{13}|\d{17})$/, {
    message: 'nidNumber must contain 10, 13, or 17 digits',
  })
  nidNumber: string;

  @IsString()
  @IsNotEmpty()
  nidFrontUrl: string;

  @IsString()
  @IsNotEmpty()
  nidBackUrl: string;

  @IsString()
  @IsNotEmpty()
  studentIdUrl: string;

  @IsString()
  @IsNotEmpty()
  presentAddress: string;

  @IsString()
  @IsNotEmpty()
  permanentAddress: string;

  @IsArray()
  @IsString({ each: true })
  documents: string[];

  @IsString()
  @IsNotEmpty({ message: 'Select the category you plan to sell in' })
  categoryId: string;

  @IsOptional()
  @IsString()
  description?: string;
}
