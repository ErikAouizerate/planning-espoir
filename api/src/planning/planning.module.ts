import { Module } from '@nestjs/common';
import { resolve } from 'path';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { Storage } from './storage';

@Module({
  controllers: [PlanningController],
  providers: [
    PlanningService,
    {
      provide: Storage,
      useFactory: () => new Storage(process.env.DATA_DIR ?? resolve(process.cwd(), 'data')),
    },
  ],
})
export class PlanningModule {}
