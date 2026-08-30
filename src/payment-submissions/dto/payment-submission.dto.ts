import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentSubmissionDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  preOrderId?: string;

  @IsOptional()
  @IsString()
  donationId?: string;

  @IsOptional()
  @IsString()
  sellerPaymentMethodId?: string;

  @IsOptional()
  @IsString()
  platformPaymentMethodId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  transactionId: string;

  @IsDateString()
  paidAt: string;

  @IsString()
  screenshotUrl: string;
}

export class VerifyPaymentSubmissionDto {
  @IsIn(['verified', 'rejected'])
  status: 'verified' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
