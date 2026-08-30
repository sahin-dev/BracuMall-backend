import { Module } from '@nestjs/common';
import { SellerApplicationsService } from './seller-applications.service';
import { SellerApplicationsController } from './seller-applications.controller';
import { UsersModule } from '../users/users.module';
import { StoresModule } from '../stores/stores.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsersModule, StoresModule, NotificationsModule],
  controllers: [SellerApplicationsController],
  providers: [SellerApplicationsService],
  exports: [SellerApplicationsService],
})
export class SellerApplicationsModule {}
