import {
  MAX_MONTH_OFFSET,
  firstOpenIso,
  initialMonthOffset,
  monthsBetween,
} from '../src/lib/calendarMonths.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

const today = new Date(2026, 7, 31); // 31 août 2026

expect(MAX_MONTH_OFFSET >= 13, 'public calendar can reach at least 13 months ahead');
expect(monthsBetween(today, new Date(2027, 8, 1)) === 13, 'Aug 2026 → Sep 2027 is 13 months');

expect(initialMonthOffset(today, []) === 0, 'no openings → stay on current month');
expect(initialMonthOffset(today, ['2026-08-31']) === 0, 'opening today → stay on current month');
expect(initialMonthOffset(today, ['2026-08-01']) === 0, 'only past openings → stay on current month');
expect(initialMonthOffset(today, ['2026-09-10']) === 1, 'next month opening → jump 1 month');
expect(
  initialMonthOffset(today, ['2027-09-01']) === 13,
  'opening on 2027-09-01 jumps to that month, not stay hidden at +2'
);
expect(
  initialMonthOffset(today, ['2026-08-01', '2027-09-01']) === 13,
  'ignores past dates when choosing the first visible month'
);
expect(
  initialMonthOffset(today, ['2028-09-01'], 18) === 18,
  'openings beyond the horizon are clamped'
);

expect(firstOpenIso('2026-09-01', []) === null, 'no openings → no admin date');
expect(firstOpenIso('2026-09-01', ['2026-09-01']) === '2026-09-01', 'today open → keep today');
expect(
  firstOpenIso('2026-09-01', ['2027-09-01']) === '2027-09-01',
  'only a future opening → jump to that day so admin slots are visible'
);
expect(
  firstOpenIso('2026-09-01', ['2026-08-31', '2026-09-02', '2027-09-01']) === '2026-09-02',
  'picks the next upcoming day, not a past one'
);

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
