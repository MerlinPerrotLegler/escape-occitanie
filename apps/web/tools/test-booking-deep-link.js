import {
  parseQueryDate,
  parseQueryTime,
  nearestOpenDay,
  closestOpenSlot,
  rankOpenDates,
  resolveBookingDeepLink,
} from '../src/lib/bookingDeepLink.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(parseQueryDate('2026-09-10') === '2026-09-10', 'ISO date');
expect(parseQueryDate('10/09/26') === '2026-09-10', 'FR short date');
expect(parseQueryDate('10-09-2026') === '2026-09-10', 'dashed FR date');
expect(parseQueryDate('2026-13-40') === null, 'invalid ISO rejected');
expect(parseQueryDate('') === null, 'empty date');

expect(parseQueryTime('14:30') === '14:30', 'HH:MM');
expect(parseQueryTime('14h30') === '14:30', 'HHhMM');
expect(parseQueryTime('9') === '09:00', 'hour only');
expect(parseQueryTime('14:15') === null, 'not aligned on 30 min');
expect(parseQueryTime('25:00') === null, 'invalid hour');

const days = {
  '2026-09-08': { open: 0, closed: true },
  '2026-09-10': { open: 0, closed: true },
  '2026-09-12': { open: 4, closed: false },
  '2027-09-01': { open: 18, closed: false },
};
expect(
  nearestOpenDay(days, '2026-09-10', '2026-08-31') === '2026-09-12',
  'closed requested day → closest open day'
);
expect(
  nearestOpenDay(days, '2026-09-12', '2026-08-31', { exclude: '2026-09-12' }) === '2027-09-01',
  'exclude current day'
);
expect(nearestOpenDay(days, '2026-09-10', '2028-01-01') === null, 'all days in the past');

expect(
  JSON.stringify(rankOpenDates(['2026-09-12', '2027-09-01', '2026-09-08'], '2026-09-10', '2026-08-31')) ===
    JSON.stringify(['2026-09-08', '2026-09-12', '2027-09-01']),
  'rank dates by distance to requested'
);
expect(
  rankOpenDates(['2026-08-01', '2027-09-01'], '2026-09-10', '2026-08-31')[0] === '2027-09-01',
  'past period dates are ignored'
);

const slots = [
  { time: '10:00', status: 'open' },
  { time: '10:30', status: 'booked' },
  { time: '14:00', status: 'open' },
  { time: '18:00', status: 'open' },
];
expect(closestOpenSlot(slots, {}) === '10:00', 'other day → first open');
expect(
  closestOpenSlot(slots, { preferredTime: '14:30' }) === '14:00',
  'preferred time picks nearest open'
);
expect(
  closestOpenSlot(slots, { preferredTime: '18:00' }) === '18:00',
  'exact preferred time'
);
expect(
  closestOpenSlot(slots, { iso: '2026-08-31', todayISO: '2026-08-31', nowMinutes: 15 * 60 }) ===
    '18:00',
  'today skips past morning slots'
);
expect(
  closestOpenSlot(slots, { iso: '2026-08-31', todayISO: '2026-08-31', nowMinutes: 22 * 60 }) ===
    null,
  'today with no remaining slot'
);

const slotsByDate = {
  '2026-09-03': [
    { time: '10:00', status: 'open' },
    { time: '13:30', status: 'reserved' },
    { time: '14:00', status: 'reserved' },
    { time: '14:30', status: 'open' },
  ],
  '2026-09-04': [{ time: '10:00', status: 'open' }],
};
const candidates = ['2026-09-03', '2026-09-04'];
const dateOnly = resolveBookingDeepLink({
  requestedISO: '2026-09-03',
  preferredTime: null,
  candidates,
  slotsByDate,
  todayISO: '2026-09-02',
  nowMinutes: 0,
});
expect(dateOnly.iso === '2026-09-03', 'date-only stays on requested day');
expect(dateOnly.slot === null, 'date-only does not auto-select first open slot');

const heureOnReserved = resolveBookingDeepLink({
  requestedISO: '2026-09-03',
  preferredTime: '13:30',
  candidates,
  slotsByDate,
  todayISO: '2026-09-02',
  nowMinutes: 0,
});
expect(heureOnReserved.iso === '2026-09-03', 'heure on reserved stays on day');
expect(heureOnReserved.slot === '14:30', 'heure on reserved picks nearest open');

const heureExact = resolveBookingDeepLink({
  requestedISO: '2026-09-03',
  preferredTime: '10:00',
  candidates,
  slotsByDate,
  todayISO: '2026-09-02',
  nowMinutes: 0,
});
expect(heureExact.slot === '10:00', 'heure exact open slot');

const closedDay = resolveBookingDeepLink({
  requestedISO: '2026-09-07',
  preferredTime: null,
  candidates: ['2026-09-09'],
  slotsByDate: {},
  todayISO: '2026-09-02',
  nowMinutes: 0,
});
expect(closedDay.iso === '2026-09-09', 'date-only closed day → nearest candidate');
expect(closedDay.slot === null, 'closed day still does not auto-select');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
