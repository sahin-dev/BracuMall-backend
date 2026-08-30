import { Module } from '@nestjs/common';
import { StoreFavoritesService } from './store-favorites.service';
import { StoreFavoritesController } from './store-favorites.controller';

@Module({
  controllers: [StoreFavoritesController],
  providers: [StoreFavoritesService],
  exports: [StoreFavoritesService],
})
export class StoreFavoritesModule {}
