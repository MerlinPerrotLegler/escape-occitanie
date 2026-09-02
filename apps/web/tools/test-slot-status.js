import { nextAdminSlotStatus, slotStatusLabel } from '../src/lib/slotStatus.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(nextAdminSlotStatus('open') === 'hidden', 'Ouvert → Invisible');
expect(nextAdminSlotStatus('hidden') === 'closed', 'Invisible → Fermé');
expect(nextAdminSlotStatus('closed') === 'open', 'Fermé → Ouvert');
expect(nextAdminSlotStatus('reserved') === null, 'Occupé does not cycle');

expect(slotStatusLabel('open') === 'Ouvert', 'open label');
expect(slotStatusLabel('hidden') === 'Invisible', 'hidden label');
expect(slotStatusLabel('closed') === 'Fermé', 'closed label');
expect(slotStatusLabel('reserved') === 'Occupé', 'reserved fallback label');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
