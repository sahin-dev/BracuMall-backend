import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminStoresController } from './admin-stores.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { StoresModule } from '../stores/stores.module';
import { ProductsModule } from '../products/products.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [NotificationsModule, StoresModule, ProductsModule, AccessControlModule, AnalyticsModule, EventsModule],
  controllers: [AdminController, AdminStoresController],
  providers: [AdminService],
})
export class AdminModule {}
