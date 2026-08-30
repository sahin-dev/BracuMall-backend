import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentMethodTypeDto } from '../../seller-payment-methods/dto/seller-payment-method.dto';

export class CreatePlatformPaymentMethodDto {
  @IsString()
  label: string;

  @IsEnum(PaymentMethodTypeDto)
  type: PaymentMethodTypeDto;

  @IsString()
  accountInfo: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class UpdatePlatformPaymentMethodDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsEnum(PaymentMethodTypeDto)
  type?: PaymentMethodTypeDto;

  @IsOptional()
  @IsString()
  accountInfo?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
