import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CreateConversationDto, SendMessageDto } from './dto/messaging.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  create(@Body() dto: CreateConversationDto, @CurrentUser('id') userId: string) {
    return this.messagingService.getOrCreate(userId, dto.otherUserId, dto.contextType, dto.contextId);
  }

  @Get()
  findMine(@CurrentUser('id') userId: string) {
    return this.messagingService.findMine(userId);
  }

  @Get('admin')
  getAdminConversation(@CurrentUser('id') userId: string) {
    return this.messagingService.getOrCreateWithAdmin(userId);
  }

  @Get(':id/messages')
  getMessages(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.messagingService.getMessages(id, userId);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @CurrentUser('id') userId: string) {
    return this.messagingService.sendMessage(id, userId, dto.content);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.messagingService.markRead(id, userId);
  }
}
