import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(160)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;
}

export class UpdateFeedbackDto {
  @IsOptional()
  @IsIn(['new', 'in_review', 'resolved', 'archived'])
  status?: 'new' | 'in_review' | 'resolved' | 'archived';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

export class FeedbackQueryDto {
  @IsOptional()
  @IsIn(['new', 'in_review', 'resolved', 'archived'])
  status?: 'new' | 'in_review' | 'resolved' | 'archived';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
