import { IsString } from 'class-validator';

export class CreateStoreFavoriteDto {
  @IsString()
  storeId: string;
}
