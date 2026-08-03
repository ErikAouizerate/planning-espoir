import { promises as fs } from 'fs';
import { join } from 'path';
import type { Config, Person, ParsingWarning } from '@planning-espoir/shared';

export interface StoredPlanning {
  people: Person[];
  warnings: ParsingWarning[];
}

export class Storage {
  constructor(private readonly dataDir: string) {}

  private file(name: string): string {
    return join(this.dataDir, name);
  }

  async savePlanningXlsx(buffer: Buffer): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.file('planning.xlsx'), buffer);
  }

  async savePlanningJson(data: StoredPlanning): Promise<void> {
    await this.writeJson('planning.json', data);
  }

  async loadPlanningJson(): Promise<StoredPlanning | null> {
    return this.readJson<StoredPlanning>('planning.json');
  }

  async loadConfig(): Promise<Config> {
    const config = await this.readJson<Config>('config.json');
    return config ?? { startDate: null, defaultName: null };
  }

  async saveConfig(config: Config): Promise<void> {
    await this.writeJson('config.json', config);
  }

  private async writeJson(name: string, value: unknown): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const file = this.file(name);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2));
    await fs.rename(tmp, file);
  }

  private async readJson<T>(name: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.file(name), 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
