import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CheckoutDto {
  @IsString()
  deliveryLocation: string;

  @IsOptional()
  @IsIn(['pickup', 'delivery'])
  fulfillmentType?: 'pickup' | 'delivery';

  @IsOptional()
  @IsDateString()
  requestedFor?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
