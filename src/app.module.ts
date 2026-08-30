import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from './config/jwt.config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SellerApplicationsModule } from './seller-applications/seller-applications.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PreOrdersModule } from './pre-orders/pre-orders.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { DeliveryLocationsModule } from './delivery-locations/delivery-locations.module';
import { UploadsModule } from './uploads/uploads.module';
import { StoresModule } from './stores/stores.module';
import { SellerPaymentMethodsModule } from './seller-payment-methods/seller-payment-methods.module';
import { PlatformPaymentMethodsModule } from './platform-payment-methods/platform-payment-methods.module';
import { CategoriesModule } from './categories/categories.module';
import { MenusModule } from './menus/menus.module';
import { CartModule } from './cart/cart.module';
import { PaymentSubmissionsModule } from './payment-submissions/payment-submissions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StoreFavoritesModule } from './store-favorites/store-favorites.module';
import { DonationsModule } from './donations/donations.module';
import { AdminModule } from './admin/admin.module';
import { EventsModule } from './events/events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagingModule } from './messaging/messaging.module';
import { ComplaintsModule } from './complaints/complaints.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.expiresIn') },
      }),
    }),
    UsersModule,
    AuthModule,
    EventsModule,
    NotificationsModule,
    MessagingModule,
    ComplaintsModule,
    UploadsModule,
    StoresModule,
    SellerApplicationsModule,
    CategoriesModule,
    MenusModule,
    ProductsModule,
    SellerPaymentMethodsModule,
    PlatformPaymentMethodsModule,
    CartModule,
    OrdersModule,
    PreOrdersModule,
    PaymentSubmissionsModule,
    ReviewsModule,
    WishlistModule,
    StoreFavoritesModule,
    DonationsModule,
    DeliveryLocationsModule,
    AdminModule,
  ],
})
export class AppModule {}
