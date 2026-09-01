import {
  MONTH_LABELS_FR,
  isoToYearMonth,
  monthBounds,
  filterPeriodsInMonth,
  buildMonthCells,
  monthYearSelectYears,
} from '../src/lib/monthYear.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(MONTH_LABELS_FR[8] === 'Septembre', 'September label');
expect(isoToYearMonth('2027-09-03') === '2027-09', 'ISO to YYYY-MM');
expect(JSON.stringify(monthBounds('2027-09')) === JSON.stringify({ from: '2027-09-01', to: '2027-09-30' }), 'September bounds');
expect(JSON.stringify(monthBounds('2028-02')) === JSON.stringify({ from: '2028-02-01', to: '2028-02-29' }), 'leap February');

const rows = [
  { id: 1, period_date: '2027-08-31' },
  { id: 2, period_date: '2027-09-01' },
  { id: 3, period_date: '2027-09-30' },
  { id: 4, period_date: '2027-10-01' },
];
expect(filterPeriodsInMonth(rows, '2027-09').map((r) => r.id).join(',') === '2,3', 'filter September');

const cells = buildMonthCells(2027, 9);
expect(cells[0] === null || cells[0].getDay() === 1, 'grid starts Monday (pad or Monday)');
expect(cells.filter(Boolean).length === 30, 'September has 30 day cells');
const firstDay = cells.find(Boolean);
expect(firstDay.getDate() === 1 && firstDay.getMonth() === 8, 'first real cell is 1 Sep');

const years = monthYearSelectYears('2026-09-01', '2027-09');
expect(years.includes('2025') && years.includes('2026') && years.includes('2027'), 'year horizon includes prev, current, selected');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
