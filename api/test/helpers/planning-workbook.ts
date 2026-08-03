import ExcelJS from 'exceljs';

export async function buildPlanningBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('A compter du 27Juillet');
  const time = (h: number, m: number): Date => new Date(Date.UTC(1899, 11, 30, h, m));
  const dayNames = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

  const people = ['TAUZIN Caroline', 'Céline PREAU'];
  const roles = ['ES -1 ETP', 'TISF 1 ETP /36'];

  ws.getCell(2, 6).value = 'PLANNING ACCUEIL URGENCE ECLUSE';
  ws.getCell(4, 1).value = 'S1';
  dayNames.forEach((name, i) => (ws.getCell(4, 2 + i * 4).value = name));
  ws.getCell(4, 30).value = 'TOTAL';

  // S1: person rows 6 and 8, role rows 7 and 9
  ws.getCell(6, 1).value = people[0];
  ws.getCell(6, 2).value = time(9, 0);
  ws.getCell(6, 3).value = time(13, 0);
  ws.getCell(6, 4).value = time(13, 30);
  ws.getCell(6, 5).value = time(17, 30);
  ws.getCell(6, 6).value = 'rh';
  ws.getCell(7, 1).value = roles[0];
  ws.getCell(8, 1).value = people[1];
  ws.getCell(9, 1).value = roles[1];

  // S2: same people, different Monday times for person 0
  ws.getCell(11, 1).value = 'S2';
  dayNames.forEach((name, i) => (ws.getCell(11, 2 + i * 4).value = name));
  ws.getCell(13, 1).value = people[0];
  ws.getCell(13, 2).value = time(8, 30);
  ws.getCell(13, 3).value = time(12, 0);
  ws.getCell(14, 1).value = roles[0];
  ws.getCell(15, 1).value = people[1];
  ws.getCell(16, 1).value = roles[1];

  // S3..S6: minimal blocks (header + people/roles) so 6 weeks exist
  for (let w = 3; w <= 6; w++) {
    const headerRow = 18 + (w - 3) * 5;
    ws.getCell(headerRow, 1).value = `S${w}`;
    dayNames.forEach((name, i) => (ws.getCell(headerRow, 2 + i * 4).value = name));
    ws.getCell(headerRow + 2, 1).value = people[0];
    ws.getCell(headerRow + 3, 1).value = roles[0];
    ws.getCell(headerRow + 4, 1).value = people[1];
    ws.getCell(headerRow + 5, 1).value = roles[1];
  }

  // junk TOTAL column (formula results) and a junk sheet that must be ignored
  ws.getCell(6, 30).value = '#REF!';
  const junkSheet = workbook.addWorksheet('Feuil1');
  junkSheet.getCell(1, 1).value = 'ignored';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
