import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviewApplicationDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsBoolean()
  identityVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  studentStatusVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  addressVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  contactVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  documentsVerified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  verificationNote?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectionReason?: string;
}
