import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  ArrayMaxSize,
  ArrayUnique,
  Max,
  Min,
  IsEnum,
} from 'class-validator';
import {
  ClothingAudience,
  ClothingType,
  FoodMealType,
  SpiceLevel,
} from '@prisma/client';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsIn(['general', 'food'])
  productType?: 'general' | 'food';

  @IsOptional()
  @IsIn(['new', 'like_new', 'good', 'fair'])
  condition?: 'new' | 'like_new' | 'good' | 'fair';

  @IsOptional()
  @IsEnum(FoodMealType)
  mealType?: FoodMealType;

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsEnum(SpiceLevel)
  spiceLevel?: SpiceLevel;

  @IsOptional()
  @IsEnum(ClothingType)
  clothingType?: ClothingType;

  @IsOptional()
  @IsEnum(ClothingAudience)
  clothingAudience?: ClothingAudience;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  sizes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsBoolean()
  isNegotiable?: boolean;

  @IsOptional()
  @IsString()
  meetupLocation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isPreOrder?: boolean;

  @IsOptional()
  @IsDateString()
  preOrderDeadline?: string;

  @IsOptional()
  @IsIn(['prepaid', 'postpaid'])
  preOrderPaymentType?: 'prepaid' | 'postpaid';

  @IsOptional()
  @IsNumber()
  @Min(0)
  preOrderDepositAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  preOrderPostpaidDepositPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  preOrderLimit?: number;

  @IsOptional()
  @IsString()
  menuId?: string;

  @IsOptional()
  @IsString()
  menuSection?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietaryTags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @IsObject()
  foodOptions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsIn(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], { each: true })
  availableDays?: string[];

  @IsOptional()
  @IsString()
  availableFrom?: string;

  @IsOptional()
  @IsString()
  availableUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  prepTimeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isMadeToOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  soldOutToday?: boolean;
}
