import { Body, Controller, Post } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AnalyzeRequestDto } from './dto/analyze.dto';

@Controller('analyze')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}
  @Post()
  analyze(@Body() dto: AnalyzeRequestDto) {
    return this.analysis.analyze(dto);
  }
}
