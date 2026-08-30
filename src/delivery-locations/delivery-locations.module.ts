import { Module } from '@nestjs/common';
import { DeliveryLocationsService } from './delivery-locations.service';
import { DeliveryLocationsController } from './delivery-locations.controller';

@Module({
  controllers: [DeliveryLocationsController],
  providers: [DeliveryLocationsService],
  exports: [DeliveryLocationsService],
})
export class DeliveryLocationsModule {}
