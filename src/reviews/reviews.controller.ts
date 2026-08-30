import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
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
  ) {
    if (productId) return this.reviewsService.findForProduct(productId);
    if (storeId) return this.reviewsService.findForStore(storeId);
    throw new BadRequestException('Provide productId or storeId');
  }
}
