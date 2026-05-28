import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AnalysisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
