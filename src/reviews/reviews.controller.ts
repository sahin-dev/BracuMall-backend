import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReplyReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  create(@Body() dto: CreateReviewDto, @CurrentUser('id') buyerId: string) {
    return this.reviewsService.create(dto, buyerId);
  }

  @Get()
  findAll(
    @Query('productId') productId?: string,
    @Query('storeId') storeId?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('stats') stats?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const offset = Math.max(Number(skip) || 0, 0);
    if (productId)
      return this.reviewsService.findForProduct(productId, offset, take);
    if (storeId && stats === 'true')
      return this.reviewsService.statsForStore(storeId);
    if (storeId) return this.reviewsService.findForStore(storeId, offset, take);
    throw new BadRequestException('Provide productId or storeId');
  }

  @Get('my-store')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  findMyStore(@CurrentUser('id') ownerId: string) {
    return this.reviewsService.findForOwner(ownerId);
  }

  @Patch(':id/helpful')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('buyer', 'seller')
  toggleHelpful(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.reviewsService.toggleHelpful(id, userId);
  }

  @Patch(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('seller')
  reply(
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.reviewsService.reply(id, ownerId, dto.message);
  }
}
