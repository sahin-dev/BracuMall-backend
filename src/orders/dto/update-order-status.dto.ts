import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'])
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
