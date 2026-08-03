import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PlanningModule } from './planning/planning.module';

@Module({
  imports: [PlanningModule],
  controllers: [AppController],
})
export class AppModule {}
