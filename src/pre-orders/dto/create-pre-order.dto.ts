import {
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

export class CreatePreOrderDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

}
