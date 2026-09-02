import { CategoryFilterType, StoreMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsEnum(StoreMode)
  mode?: StoreMode;

  @IsOptional()
  @IsEnum(CategoryFilterType)
  filterType?: CategoryFilterType;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsEnum(StoreMode)
  mode?: StoreMode;

  @IsOptional()
  @IsEnum(CategoryFilterType)
  filterType?: CategoryFilterType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
