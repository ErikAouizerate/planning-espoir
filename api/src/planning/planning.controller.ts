import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Config } from '@planning-espoir/shared';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.planningService.upload(file);
  }

  @Get()
  getPlanning() {
    return this.planningService.getPlanning();
  }

  @Get('schedule')
  getSchedule(@Query('month') month: string) {
    return this.planningService.getSchedule(month);
  }

  @Get('config')
  getConfig() {
    return this.planningService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() body: Partial<Config>) {
    return this.planningService.updateConfig(body);
  }
}
