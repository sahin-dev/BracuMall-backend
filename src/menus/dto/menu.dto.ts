import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateMenuDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  autoSchedule?: boolean;

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
  sortOrder?: number;
}

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSchedule?: boolean;

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
  sortOrder?: number;
}
