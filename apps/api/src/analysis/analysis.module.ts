import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { ExplanationService } from './explanation.service';

@Module({
  // ConfigModule is global at app boot, but importing it here keeps ConfigService
  // resolvable when AnalysisModule is mounted standalone (e.g. in e2e tests).
  imports: [ConfigModule],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    ExplanationService,
    {
      provide: OpenAI,
      // key may be absent in dev; fallback keeps boot alive — real calls fail at request time until a key is set
      useFactory: (c: ConfigService) => new OpenAI({ apiKey: c.get<string>('OPENAI_API_KEY') || 'sk-no-key-set' }),
      inject: [ConfigService],
    },
  ],
})
export class AnalysisModule {}
