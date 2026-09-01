import { fullYear, pad2, yearSelectOptions } from './shortDate.js';

export const MONTH_LABELS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export function isoToYearMonth(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.slice(0, 7);
}

export function monthBounds(yearMonth) {
  const match = String(yearMonth || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(last)}`,
  };
}

export function filterPeriodsInMonth(periods, yearMonth) {
  const bounds = monthBounds(yearMonth);
  if (!bounds) return [];
  return (periods || []).filter((row) => row.period_date >= bounds.from && row.period_date <= bounds.to);
}

export function buildMonthCells(year, month1to12) {
  const first = new Date(year, month1to12 - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month1to12 - 1, day));
  return cells;
}

export function monthYearSelectYears(todayIso, selectedYearMonth) {
  const selectedIso = /^\d{4}-\d{2}$/.test(selectedYearMonth || '')
    ? `${selectedYearMonth}-01`
    : todayIso;
  return yearSelectOptions(todayIso, selectedIso).map((yy) => String(fullYear(yy)));
}
