import {
  datePartsToIso,
  daysInMonth,
  isoToDateParts,
  isoToShortDate,
  shiftIsoDate,
  shortDateToIso,
  yearSelectOptions,
} from '../src/lib/shortDate.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(isoToShortDate('2027-09-01') === '01/09/2027', 'admin/public dates show the full year');
expect(isoToShortDate('2026-09-10') === '10/09/2026', '2026 stays explicit');
expect(shortDateToIso('01/09/27') === '2027-09-01', '2-digit year 27 → 2027');
expect(shortDateToIso('01/09/2027') === '2027-09-01', '4-digit year parses');
expect(shortDateToIso('10/09/26') === '2026-09-10', '2-digit year 26 → 2026');

expect(JSON.stringify(isoToDateParts('2026-09-01')) === JSON.stringify({ day: '01', month: '09', year: '26' }), 'ISO splits into JJ/MM/AA parts');
expect(datePartsToIso('01', '09', '26') === '2026-09-01', 'JJ/MM/AA parts rebuild ISO');
expect(datePartsToIso('31', '02', '26') === '2026-02-28', '31 Feb clamps to last day of month');
expect(daysInMonth(2026, 2) === 28, 'Feb 2026 has 28 days');
expect(daysInMonth(2028, 2) === 29, 'Feb 2028 has 29 days');
expect(daysInMonth(26, 9) === 30, '2-digit year 26 is 2026');
expect(
  yearSelectOptions('2026-09-01').join(',') === '25,26,27,28',
  'year list covers previous year through the 18-month booking horizon'
);
expect(yearSelectOptions('2026-09-01', '2029-01-15').join(',') === '25,26,27,28,29', 'selected year outside the window stays available');

expect(shiftIsoDate('2026-09-01', -1) === '2026-08-31', 'J-1 crosses month boundary');
expect(shiftIsoDate('2026-09-01', 1) === '2026-09-02', 'J+1 stays in month');
expect(shiftIsoDate('2026-12-31', 1) === '2027-01-01', 'J+1 crosses year');
expect(shiftIsoDate('2028-02-28', 1) === '2028-02-29', 'J+1 into leap day');
expect(shiftIsoDate('not-a-date', 1) === null, 'invalid ISO is rejected');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
