import ExcelJS from 'exceljs';
import { buildPlanningBuffer } from '../../test/helpers/planning-workbook';
import { parsePlanning, PlanningFormatError } from './parser';

describe('parsePlanning', () => {
  it('parses people, roles and color indexes from S1', async () => {
    const parsed = await parsePlanning(
      await buildPlanningBuffer(),
      'Copie de Planning ecluse Proposition Aout 2026.xlsx',
    );
    expect(parsed.planning.people).toHaveLength(2);
    const [first, second] = parsed.planning.people;
    expect(first.name).toBe('TAUZIN Caroline');
    expect(first.role).toBe('ES -1 ETP');
    expect(first.colorIndex).toBe(0);
    expect(second.name).toBe('Céline PREAU');
    expect(second.colorIndex).toBe(1);
  });

  it('parses a two-slot day from S1 week 1', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'plan.xlsx');
    const monday = parsed.planning.people[0].weeks[0][0];
    expect(monday).toEqual({
      type: 'shift',
      slots: [
        { start: '09:00', end: '13:00' },
        { start: '13:30', end: '17:30' },
      ],
    });
  });

  it('assigns later weeks to the same person by index', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'plan.xlsx');
    const s2Monday = parsed.planning.people[0].weeks[1][0];
    expect(s2Monday).toEqual({
      type: 'shift',
      slots: [{ start: '08:30', end: '12:00' }],
    });
  });

  it('keeps six weeks of empty cells for unset weeks', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'plan.xlsx');
    expect(parsed.planning.people[0].weeks).toHaveLength(6);
    expect(parsed.planning.people[0].weeks[5][6]).toEqual({ type: 'none' });
  });

  it('extracts the start date from the sheet name and filename', async () => {
    const parsed = await parsePlanning(
      await buildPlanningBuffer(),
      'Copie de Planning ecluse Proposition Aout 2026.xlsx',
    );
    expect(parsed.startDate).toBe('2026-07-27');
  });

  it('throws PlanningFormatError for a non-xlsx buffer', async () => {
    await expect(parsePlanning(Buffer.from('not an xlsx'), 'notes.txt')).rejects.toThrow(
      PlanningFormatError,
    );
  });

  it('throws PlanningFormatError when no S1 block exists', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parsePlanning(buffer, 'empty.xlsx')).rejects.toThrow(PlanningFormatError);
  });

  it('reports warnings for unparseable non-empty time cells', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('A compter du 27Juillet');
    ws.getCell(1, 1).value = 'S1';
    ['LUNDI'].forEach((name, i) => (ws.getCell(1, 2 + i * 4).value = name));
    ws.getCell(3, 1).value = 'TAUZIN Caroline';
    ws.getCell(4, 1).value = 'ES -1 ETP';
    ws.getCell(3, 2).value = '9?30';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parsePlanning(buffer, 'plan.xlsx');
    expect(parsed.warnings.length).toBeGreaterThan(0);
    expect(parsed.warnings[0].value).toBe('9?30');
  });

  it('parses an rh text cell in a day as an off cell', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('A compter du 27Juillet');
    ws.getCell(1, 1).value = 'S1';
    ['LUNDI'].forEach((name, i) => (ws.getCell(1, 2 + i * 4).value = name));
    ws.getCell(3, 1).value = 'TAUZIN Caroline';
    ws.getCell(4, 1).value = 'ES -1 ETP';
    ws.getCell(3, 2).value = 'rh';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parsePlanning(buffer, 'plan.xlsx');
    const monday = parsed.planning.people[0].weeks[0][0];
    expect(monday).toEqual({ type: 'off', label: 'rh' });
    expect(parsed.warnings).toEqual([]);
  });

  it('parses lenient time separators like 18;30 into a slot', async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('A compter du 27Juillet');
    ws.getCell(1, 1).value = 'S1';
    ['LUNDI'].forEach((name, i) => (ws.getCell(1, 2 + i * 4).value = name));
    ws.getCell(3, 1).value = 'TAUZIN Caroline';
    ws.getCell(4, 1).value = 'ES -1 ETP';
    ws.getCell(3, 2).value = '14;00';
    ws.getCell(3, 3).value = '18;30';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parsePlanning(buffer, 'plan.xlsx');
    const monday = parsed.planning.people[0].weeks[0][0];
    expect(monday).toEqual({
      type: 'shift',
      slots: [{ start: '14:00', end: '18:30' }],
    });
    expect(parsed.warnings).toEqual([]);
  });
});
