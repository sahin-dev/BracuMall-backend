import { IsString } from 'class-validator';

export class UpdateSellingCategoriesDto {
  @IsString()
  categoryId: string;
}
