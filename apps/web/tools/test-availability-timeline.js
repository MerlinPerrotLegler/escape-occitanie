import {
  PAGE_SIZE,
  buildColumns,
  formatDayHeading,
  formatPageRange,
  groupColumnsByDay,
  isSlotBookable,
  openDayIsos,
  pageSlice,
} from '../src/lib/availabilityTimeline.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(PAGE_SIZE === 1, 'PAGE_SIZE is 1 (one day at a time)');

expect(openDayIsos([], '2026-09-02').length === 0, 'no periods');
expect(
  openDayIsos(['2026-09-01', '2026-09-03', '2026-09-03', '2026-08-31'], '2026-09-02').join(',') ===
    '2026-09-03',
  'drops past and duplicates, keeps upcoming sorted'
);
expect(
  openDayIsos(['2026-09-02', '2026-09-04'], '2026-09-02').join(',') === '2026-09-02,2026-09-04',
  'includes today'
);

const empty = pageSlice([], 0);
expect(empty.days.length === 0 && empty.pageCount === 0 && empty.hasPrev === false && empty.hasNext === false, 'empty pageSlice');

const seven = ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08'];
const p0 = pageSlice(seven, 0);
expect(p0.days.join(',') === '2026-09-02' && p0.pageCount === 7 && p0.hasPrev === false && p0.hasNext === true, '7 days → 7 pages of 1');

const p1 = pageSlice(seven, 1);
expect(p1.days.join(',') === '2026-09-03' && p1.hasPrev === true && p1.hasNext === true, 'page 1 is the second day');
expect(pageSlice(seven, 99).pageIndex === 6, 'pageIndex clamped to last');
expect(pageSlice(seven, 6).hasNext === false, 'last page has no next');

const open = { time: '14:00', status: 'open' };
expect(isSlotBookable(open, { iso: '2026-09-03', todayISO: '2026-09-02', nowMinutes: 12 * 60 }) === true, 'future open');
expect(isSlotBookable(open, { iso: '2026-09-02', todayISO: '2026-09-02', nowMinutes: 13 * 60 }) === true, 'today later');
expect(isSlotBookable(open, { iso: '2026-09-02', todayISO: '2026-09-02', nowMinutes: 14 * 60 + 1 }) === false, 'today already past');
expect(isSlotBookable({ time: '14:00', status: 'reserved' }, { iso: '2026-09-03', todayISO: '2026-09-02', nowMinutes: 0 }) === false, 'reserved');
expect(isSlotBookable(open, { iso: '2026-09-01', todayISO: '2026-09-02', nowMinutes: 0 }) === false, 'past day');
expect(isSlotBookable(null, { iso: '2026-09-03', todayISO: '2026-09-02', nowMinutes: 0 }) === false, 'missing slot');

const days = ['2026-09-02', '2026-09-03'];
const slotsByRoomByDate = {
  directeur: {
    '2026-09-02': [
      { time: '14:00', status: 'open' },
      { time: '14:30', status: 'reserved' },
    ],
    '2026-09-03': [],
  },
  vaisseau: {
    '2026-09-02': [{ time: '14:00', status: 'closed' }, { time: '15:00', status: 'open' }],
    '2026-09-03': [],
  },
};
const cols = buildColumns(days, slotsByRoomByDate, {
  todayISO: '2026-09-01',
  nowMinutes: 0,
  roomSlugs: ['directeur', 'vaisseau'],
});
expect(cols.map((c) => `${c.iso} ${c.time}`).join('|') === '2026-09-02 14:00|2026-09-02 15:00', 'union of bookable times, skip empty day and fully unavailable rows');
expect(cols[0].cells.directeur === 'open' && cols[0].cells.vaisseau === 'unavailable', 'A open B closed');
expect(cols[1].cells.directeur === 'unavailable' && cols[1].cells.vaisseau === 'open', 'missing / open');

const mixedSteps = buildColumns(['2026-09-02'], {
  directeur: {
    '2026-09-02': [
      { time: '14:00', status: 'open' },
      { time: '14:15', status: 'open' },
      { time: '14:30', status: 'open' },
    ],
  },
  vaisseau: { '2026-09-02': [{ time: '14:15', status: 'open' }] },
}, {
  todayISO: '2026-09-01',
  nowMinutes: 0,
  roomSlugs: ['directeur', 'vaisseau'],
  slotMinutes: 30,
});
expect(mixedSteps.map((c) => c.time).join('|') === '14:00|14:30', 'keeps starts aligned to slot_minutes like the calendar');

const quarterSteps = buildColumns(['2026-09-02'], {
  directeur: {
    '2026-09-02': [
      { time: '14:00', status: 'open' },
      { time: '14:15', status: 'open' },
      { time: '14:30', status: 'open' },
    ],
  },
  vaisseau: { '2026-09-02': [] },
}, {
  todayISO: '2026-09-01',
  nowMinutes: 0,
  roomSlugs: ['directeur', 'vaisseau'],
  slotMinutes: 15,
});
expect(quarterSteps.map((c) => c.time).join('|') === '14:00|14:15|14:30', '15-min config keeps quarter-hour starts like the calendar');

const grouped = groupColumnsByDay(cols);
expect(grouped.length === 1 && grouped[0].iso === '2026-09-02' && grouped[0].columns.length === 2, 'one day group');

expect(
  buildColumns(['2026-09-10'], { directeur: { '2026-09-10': [] }, vaisseau: { '2026-09-10': [] } }, {
    todayISO: '2026-09-01',
    nowMinutes: 0,
    roomSlugs: ['directeur', 'vaisseau'],
  }).length === 0,
  'a day with no slots is skipped'
);

const bookedOnly = buildColumns(['2026-09-11'], {
  directeur: { '2026-09-11': [{ time: '14:00', status: 'reserved' }] },
  vaisseau: { '2026-09-11': [{ time: '14:00', status: 'closed' }] },
}, {
  todayISO: '2026-09-01',
  nowMinutes: 0,
  roomSlugs: ['directeur', 'vaisseau'],
});
expect(bookedOnly.length === 0, 'a day with no bookable slot is skipped');

expect(formatDayHeading('2026-09-02', '2026-09-02').toLowerCase().includes('sept'), 'heading has month, no forced year');
expect(formatDayHeading('2027-01-01', '2026-09-02').includes('2027'), 'other year shows year');
expect(formatPageRange([]) === '', 'empty range');
expect(formatPageRange(['2026-09-01']).includes('1'), 'single day');
expect(formatPageRange(['2026-09-01', '2026-09-07']).includes('1') && formatPageRange(['2026-09-01', '2026-09-07']).includes('7'), 'same-month span');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
