import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class UpdateSellingCategoriesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one category' })
  @IsString({ each: true })
  categoryIds: string[];
}
