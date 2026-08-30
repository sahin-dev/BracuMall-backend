import { IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  otherUserId: string;

  @IsOptional()
  @IsString()
  contextType?: string;

  @IsOptional()
  @IsString()
  contextId?: string;
}

export class SendMessageDto {
  @IsString()
  content: string;
}
