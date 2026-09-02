import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { CouponsModule } from './coupons/coupons.module';
import { HeroSlidesModule } from './hero-slides/hero-slides.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { ApiThrottlerGuard } from './common/guards/api-throttler.guard';
import { positiveInteger } from './common/rate-limit/rate-limit.util';
import { AccessControlModule } from './access-control/access-control.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: positiveInteger(config.get('RATE_LIMIT_TTL_MS'), 60_000),
            limit: positiveInteger(config.get('RATE_LIMIT_MAX'), 120),
            blockDuration: positiveInteger(
              config.get('RATE_LIMIT_BLOCK_MS'),
              60_000,
            ),
          },
        ],
        errorMessage: 'Too many requests. Please try again shortly.',
      }),
    }),
    PrismaModule,
    AccessControlModule,
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
    CouponsModule,
    HeroSlidesModule,
    PlatformSettingsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ApiThrottlerGuard }],
})
export class AppModule {}
