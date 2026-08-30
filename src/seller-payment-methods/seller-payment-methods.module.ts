import { Module } from '@nestjs/common';
import { SellerPaymentMethodsService } from './seller-payment-methods.service';
import { SellerPaymentMethodsController } from './seller-payment-methods.controller';

@Module({
  controllers: [SellerPaymentMethodsController],
  providers: [SellerPaymentMethodsService],
  exports: [SellerPaymentMethodsService],
})
export class SellerPaymentMethodsModule {}
