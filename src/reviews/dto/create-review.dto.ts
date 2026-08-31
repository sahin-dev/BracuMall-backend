import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  productId: string;

  @IsString()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tasteRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  qualityRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  valueRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  packagingRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  serviceRating?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsString({ each: true })
  images?: string[];
}

export class ReplyReviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;
}
