import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentSubmissionsService } from './payment-submissions.service';
import {
  CreatePaymentSubmissionDto,
  VerifyPaymentSubmissionDto,
} from './dto/payment-submission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('payment-submissions')
@UseGuards(JwtAuthGuard)
export class PaymentSubmissionsController {
  constructor(private readonly service: PaymentSubmissionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('buyer', 'seller')
  create(
    @Body() dto: CreatePaymentSubmissionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('buyer', 'seller', 'admin')
  @Permissions('finance.read')
  findFor(
    @Query('orderId') orderId: string,
    @Query('preOrderId') preOrderId: string,
    @Query('donationId') donationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.findFor(
      { orderId, preOrderId, donationId },
      userId,
      role,
    );
  }

  @Patch(':id/verify')
  @UseGuards(RolesGuard)
  @Roles('seller', 'admin')
  @Permissions('finance.manage')
  verify(
    @Param('id') id: string,
    @Body() dto: VerifyPaymentSubmissionDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.verify(id, dto, userId, role);
  }
}
