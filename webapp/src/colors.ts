export const PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
];

export function colorFor(colorIndex: number, palette: string[] = PALETTE): string {
  return palette[colorIndex % palette.length] ?? palette[0];
}
