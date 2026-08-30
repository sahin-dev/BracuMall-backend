import { IsArray, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateComplaintDto {
  @IsIn(['order', 'product', 'store', 'user'])
  targetType: 'order' | 'product' | 'store' | 'user';

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsIn(['item_quality', 'wrong_item', 'not_received', 'payment', 'seller_behavior', 'buyer_behavior', 'misleading_listing', 'counterfeit', 'other'])
  category?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  severity?: string;

  @IsOptional()
  @IsDateString()
  occurrenceAt?: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}

export class UpdateComplaintStatusDto {
  @IsIn(['open', 'investigating', 'resolved', 'dismissed'])
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';

  @IsOptional()
  @IsString()
  resolution?: string;
}

export class ComplaintResponseDto {
  @IsString()
  response: string;
}
