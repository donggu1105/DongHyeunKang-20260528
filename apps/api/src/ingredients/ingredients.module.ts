import { Module } from '@nestjs/common';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

// PrismaModule is @Global, so PrismaService is resolvable without re-importing it here.
@Module({
  controllers: [IngredientsController],
  providers: [IngredientsService],
})
export class IngredientsModule {}
