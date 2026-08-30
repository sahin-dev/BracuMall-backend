import { IsString, IsOptional } from 'class-validator';

export class CreateWishlistDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  productImage?: string;

  @IsOptional()
  productPrice?: number;
}
