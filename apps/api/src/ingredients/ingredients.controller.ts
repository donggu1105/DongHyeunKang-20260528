import { Controller, Get } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientsService) {}
  @Get()
  list() {
    return this.ingredients.list();
  }
}
