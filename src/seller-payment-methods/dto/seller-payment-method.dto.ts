import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum PaymentMethodTypeDto {
  bkash = 'bkash',
  nagad = 'nagad',
  rocket = 'rocket',
  bank = 'bank',
  cash = 'cash',
  other = 'other',
}

export class CreateSellerPaymentMethodDto {
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

export class UpdateSellerPaymentMethodDto {
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
