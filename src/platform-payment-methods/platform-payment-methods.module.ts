import { Module } from '@nestjs/common';
import { PlatformPaymentMethodsService } from './platform-payment-methods.service';
import { PlatformPaymentMethodsController } from './platform-payment-methods.controller';

@Module({
  controllers: [PlatformPaymentMethodsController],
  providers: [PlatformPaymentMethodsService],
  exports: [PlatformPaymentMethodsService],
})
export class PlatformPaymentMethodsModule {}
