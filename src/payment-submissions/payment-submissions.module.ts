import { Module } from '@nestjs/common';
import { PaymentSubmissionsService } from './payment-submissions.service';
import { PaymentSubmissionsController } from './payment-submissions.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentSubmissionsController],
  providers: [PaymentSubmissionsService],
  exports: [PaymentSubmissionsService],
})
export class PaymentSubmissionsModule {}
