import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

// PrismaModule is @Global, so PrismaService is resolvable without re-importing it here.
@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
