import {
  BOOKING_FILTERS,
  bookingSortMatches,
  defaultReservationsFilter,
  parseBookingDir,
  parseBookingFilter,
  parseBookingSort,
  parseLocationHash,
  parsePage,
  pendingBadgeLabel,
  reservationsHash,
  reservationsTabHash,
} from '../src/lib/reservationsHash.js';
import { occupancyFromSettings, normalizeBookingSettings } from '../src/lib/booking.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(BOOKING_FILTERS.map((item) => item.id).join(',') === 'aujourdhui,demain,a-confirmer,avis,toutes', 'filter ids');
expect(parseBookingFilter('today') === 'aujourdhui', 'today alias');
expect(parseBookingFilter('demain') === 'demain', 'demain filter');
expect(parseBookingFilter('tomorrow') === 'demain', 'tomorrow alias');
expect(parseBookingFilter('pending') === 'a-confirmer', 'pending alias');
expect(parseBookingFilter('all') === 'toutes', 'all alias');
expect(parseBookingFilter('avis') === 'avis', 'avis filter');
expect(parseBookingFilter("aujourd'hui") === 'aujourdhui', 'accented label');
expect(parsePage('2') === 2, 'page 2');
expect(parsePage('0') === 1, 'page 0 falls back to 1');
expect(parsePage('nope') === 1, 'invalid page falls back to 1');
expect(parseBookingSort('client') === 'client', 'sort client');
expect(parseBookingSort('heure') === 'date', 'heure sort is the same as date');
expect(parseBookingSort('date') === 'date', 'date sort');
expect(bookingSortMatches('heure', 'date') === true, 'date and heure match');
expect(bookingSortMatches('date', 'heure') === true, 'heure and date match');
expect(bookingSortMatches('client', 'date') === false, 'client is not datetime');
expect(parseBookingSort('nope') === null, 'invalid sort ignored');
expect(parseBookingDir('desc') === 'desc', 'dir desc');
expect(parseBookingDir('nope') === 'asc', 'invalid dir falls back to asc');

const parsed = parseLocationHash('#reservations?filtre=a-confirmer&page=3');
expect(parsed.tab === 'reservations', 'tab from hash');
expect(parsed.filtre === 'a-confirmer', 'filtre from hash');
expect(parsed.page === 3, 'page from hash');
expect(parsed.focusBookingId === null, 'no focus');

const focused = parseLocationHash('#reservations/42?filtre=toutes&page=2');
expect(focused.focusBookingId === 42, 'focus id');
expect(focused.filtre === 'toutes', 'focus keeps filter');
expect(focused.page === 2, 'focus keeps page');

expect(parseLocationHash('#planning').tab === 'planning', 'planning tab');
expect(parseLocationHash('#avis').tab === 'records', 'hash #avis stays records tab');
expect(parseLocationHash('#reservations?filtre=avis&page=1').filtre === 'avis', 'avis from hash');
expect(parseLocationHash('#reservations?filtre=demain&page=1').filtre === 'demain', 'demain from hash');
expect(parseLocationHash('#reservations').filtre === 'aujourdhui', 'default filter');
expect(parseLocationHash('#reservations').filtreExplicit === false, 'bare reservations hash is not explicit');
expect(parseLocationHash('#reservations?filtre=aujourdhui').filtreExplicit === true, 'today query is explicit');
expect(parseLocationHash('#reservations?filtre=a-confirmer').filtreExplicit === true, 'to-confirm query is explicit');
expect(parseLocationHash('').tab === 'reservations', 'empty hash defaults to reservations');
expect(parseLocationHash('').filtreExplicit === false, 'empty hash is not explicit');
expect(parseLocationHash('#reservations').tri === null, 'no sort by default');
expect(parseLocationHash('#reservations?filtre=toutes&page=1&tri=client&sens=desc').tri === 'client', 'sort from hash');
expect(parseLocationHash('#reservations?filtre=toutes&page=1&tri=client&sens=desc').sens === 'desc', 'dir from hash');

expect(pendingBadgeLabel(0) === '', 'badge hidden when empty');
expect(pendingBadgeLabel(1) === '1', 'badge shows 1');
expect(pendingBadgeLabel(9) === '9', 'badge shows 9');
expect(pendingBadgeLabel(10) === '+', 'badge caps above 9');
expect(pendingBadgeLabel(99) === '+', 'badge caps large counts');

expect(defaultReservationsFilter(0) === 'aujourdhui', 'no pending → today');
expect(defaultReservationsFilter(3) === 'a-confirmer', 'pending → to confirm');
expect(defaultReservationsFilter(5, 'aujourdhui') === 'aujourdhui', 'explicit today wins');
expect(defaultReservationsFilter(0, 'a-confirmer') === 'a-confirmer', 'explicit to-confirm kept');

expect(
  reservationsTabHash(0) === '#reservations?filtre=aujourdhui&page=1',
  'tab without pending opens today'
);
expect(
  reservationsTabHash(2) === '#reservations?filtre=a-confirmer&page=1',
  'tab with pending opens to confirm'
);

expect(
  reservationsHash({ filtre: 'aujourdhui', page: 1 }) === '#reservations?filtre=aujourdhui&page=1',
  'serializes default reservations hash'
);
expect(
  reservationsHash({ filtre: 'toutes', page: 4, focusBookingId: 9 }) ===
    '#reservations/9?filtre=toutes&page=4',
  'serializes focus + page'
);
expect(
  reservationsHash({ filtre: 'demain', page: 1 }) === '#reservations?filtre=demain&page=1',
  'serializes tomorrow filter'
);
expect(
  reservationsHash({ filtre: 'toutes', page: 1, tri: 'client', sens: 'desc' }) ===
    '#reservations?filtre=toutes&page=1&tri=client&sens=desc',
  'serializes sort'
);
expect(
  reservationsHash({ filtre: 'toutes', page: 1, tri: 'heure', sens: 'asc' }) ===
    '#reservations?filtre=toutes&page=1&tri=date&sens=asc',
  'heure serializes as date'
);
expect(parseLocationHash('#reservations?filtre=toutes&page=1&tri=heure&sens=desc').tri === 'date', 'heure hash canonicalizes to date');

expect(occupancyFromSettings({ slot_minutes: 30, block_next_slot: true }) === 60, '30+next = 60');
expect(occupancyFromSettings({ slot_minutes: 30, block_next_slot: false }) === 30, '30 without next');
expect(occupancyFromSettings({ slot_minutes: 15, block_next_slot: true }) === 30, '15+next = 30');
expect(occupancyFromSettings({ slot_minutes: 60, block_next_slot: true }) === 120, '60+next = 120');
expect(normalizeBookingSettings({ slot_minutes: 12, block_next_slot: 1 }).slot_minutes === 30, 'invalid slot falls back');
expect(normalizeBookingSettings({ auto_confirm: true }).auto_confirm === true, 'auto confirm');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
