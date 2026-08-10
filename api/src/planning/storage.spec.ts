import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Storage } from './storage';

describe('Storage', () => {
  let dir: string;
  let storage: Storage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'planning-test-'));
    storage = new Storage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null config defaults when nothing is stored', async () => {
    await expect(storage.loadConfig()).resolves.toEqual({
      startDate: null,
      defaultNames: [],
      fileName: null,
    });
  });

  it('normalizes a legacy config file with defaultName', async () => {
    await writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ startDate: '2026-07-27', defaultName: 'BOB Dylan', fileName: 'p.xlsx' }),
    );
    await expect(storage.loadConfig()).resolves.toEqual({
      startDate: '2026-07-27',
      defaultNames: [],
      fileName: 'p.xlsx',
    });
  });

  it('round-trips a planning JSON', async () => {
    const data = {
      people: [
        {
          name: 'TAUZIN Caroline',
          role: 'ES -1 ETP',
          colorIndex: 0,
          weeks: [],
        },
      ],
      warnings: [],
    };
    await storage.savePlanningJson(data);
    await expect(storage.loadPlanningJson()).resolves.toEqual(data);
  });

  it('round-trips config', async () => {
    await storage.saveConfig({
      startDate: '2026-07-27',
      defaultNames: ['BOB Dylan'],
      fileName: null,
    });
    await expect(storage.loadConfig()).resolves.toEqual({
      startDate: '2026-07-27',
      defaultNames: ['BOB Dylan'],
      fileName: null,
    });
  });

  it('returns null when no planning JSON exists', async () => {
    await expect(storage.loadPlanningJson()).resolves.toBeNull();
  });
});
