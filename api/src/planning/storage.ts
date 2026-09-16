import { promises as fs } from 'fs';
import type { Config, Person, ParsingWarning } from '@planning-espoir/shared';

const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface StoredPlanning {
  people: Person[];
  warnings: ParsingWarning[];
}

export class Storage {
  constructor(private readonly dataDir: string) {}

  private file(name: string): string {
    if (!FILE_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid storage file name: ${name}`);
    }
    return `${this.dataDir.replace(/[\\/]+$/, '')}/${name}`;
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
    const raw = await this.readJson<Record<string, unknown>>('config.json');
    if (!raw) return { startDate: null, defaultNames: [], fileName: null };
    return {
      startDate: typeof raw.startDate === 'string' ? raw.startDate : null,
      defaultNames: Array.isArray(raw.defaultNames)
        ? raw.defaultNames.filter((n): n is string => typeof n === 'string')
        : [],
      fileName: typeof raw.fileName === 'string' ? raw.fileName : null,
    };
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
