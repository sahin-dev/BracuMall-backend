import { IsIn } from 'class-validator';

export class UpdatePreOrderStatusDto {
  @IsIn(['pending', 'awaiting_payment', 'confirmed', 'fulfilled', 'cancelled'])
  status: string;
}
