import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

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
  verificationNote?: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
