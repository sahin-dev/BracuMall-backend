import {
  IsArray,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

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
}
