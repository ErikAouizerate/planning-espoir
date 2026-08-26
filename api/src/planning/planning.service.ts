import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Config,
  Person,
  PersonDay,
  ParsingWarning,
  ScheduleMonth,
} from '@planning-espoir/shared';
import {
  monthDays,
  isValidMonth,
  isValidDateKey,
  weekIndexForDate,
  weekdayIndex,
} from './date-rotation';
import { parsePlanning, PlanningFormatError } from './parser';
import { Storage } from './storage';
import type { MulterFile } from './multer-file';

export interface PlanningResponse {
  startDate: string | null;
  people: Person[];
  warnings: ParsingWarning[];
}

@Injectable()
export class PlanningService {
  constructor(private readonly storage: Storage) {}

  async upload(file: MulterFile): Promise<PlanningResponse> {
    if (!file) throw new BadRequestException('file is required');
    let parsed;
    try {
      parsed = await parsePlanning(file.buffer, file.originalname);
    } catch (error) {
      if (error instanceof PlanningFormatError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    await this.storage.savePlanningXlsx(file.buffer);
    await this.storage.savePlanningJson({
      people: parsed.planning.people,
      warnings: parsed.warnings,
    });
    const config = await this.storage.loadConfig();
    config.fileName = file.originalname;
    if (parsed.startDate !== null) {
      config.startDate = parsed.startDate;
    }
    await this.storage.saveConfig(config);
    return {
      startDate: parsed.startDate,
      people: parsed.planning.people,
      warnings: parsed.warnings,
    };
  }

  async getPlanning(): Promise<PlanningResponse> {
    const stored = await this.storage.loadPlanningJson();
    if (!stored) throw new NotFoundException('No planning uploaded yet');
    const config = await this.storage.loadConfig();
    return { startDate: config.startDate, people: stored.people, warnings: stored.warnings };
  }

  async getSchedule(month: string): Promise<ScheduleMonth> {
    if (!isValidMonth(month)) throw new BadRequestException('month must be YYYY-MM');
    const stored = await this.storage.loadPlanningJson();
    if (!stored) throw new NotFoundException('No planning uploaded yet');
    const config = await this.storage.loadConfig();
    if (!config.startDate) throw new BadRequestException('startDate is not configured');

    const days: Record<string, PersonDay[]> = {};
    const mondayWeeks: Record<string, number> = {};
    for (const date of monthDays(month)) {
      const week = weekIndexForDate(config.startDate, date);
      const day = weekdayIndex(date);
      if (day === 0) {
        mondayWeeks[date] = week + 1; // 1-based: 1 = S1 .. 6 = S6
      }
      days[date] = stored.people.map((p) => ({
        name: p.name,
        colorIndex: p.colorIndex,
        cell: p.weeks[week][day],
      }));
    }
    return { month, days, mondayWeeks };
  }

  async getConfig(): Promise<Config> {
    return this.storage.loadConfig();
  }

  async updateConfig(update: Partial<Config>): Promise<Config> {
    const config = await this.storage.loadConfig();
    if (update.startDate !== undefined) {
      if (update.startDate !== null && !isValidDateKey(update.startDate)) {
        throw new BadRequestException('startDate must be YYYY-MM-DD');
      }
      config.startDate = update.startDate;
    }
    if (update.defaultNames !== undefined) {
      if (
        !Array.isArray(update.defaultNames) ||
        update.defaultNames.some((n) => typeof n !== 'string')
      ) {
        throw new BadRequestException('defaultNames must be an array of strings');
      }
      config.defaultNames = update.defaultNames;
    }
    await this.storage.saveConfig(config);
    return config;
  }
}
