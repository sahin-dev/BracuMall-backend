import { StoreMode } from '@prisma/client';
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
  @IsBoolean()
  isActive?: boolean;
}
