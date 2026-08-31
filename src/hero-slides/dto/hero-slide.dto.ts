import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateHeroSlideDto {
  @IsString()
  imageUrl: string;

  @IsString()
  headline: string;

  @IsOptional()
  @IsString()
  subtext?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateHeroSlideDto {
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  subtext?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
