export interface PeriodSeed {
  bookId: number;
  period: string; // YYYY-MM
  isYearEnd: boolean;
}

export function buildPeriods(
  bookId: number,
  startDate: Date,
  endDate: Date,
): PeriodSeed[] {
  const periods: PeriodSeed[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= end) {
    const period = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    periods.push({ bookId, period, isYearEnd: cursor.getMonth() === 11 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}
