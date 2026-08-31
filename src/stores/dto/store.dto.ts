import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptsPickup?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptsDelivery?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  prepTimeMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  prepTimeMax?: number;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  foodSafetyNote?: string;

  @IsOptional()
  @IsHexColor()
  brandColor?: string;
}
