import {
  DEFAULT_SLOT_PRICE,
  formatPriceAmount,
  pricePerPerson,
  slotPriceFromCopy,
} from '../src/lib/bookingPrice.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(DEFAULT_SLOT_PRICE === 120, 'default slot is 120');
expect(pricePerPerson(3) === 40, '3 players');
expect(pricePerPerson(4) === 30, '4 players');
expect(pricePerPerson(5) === 24, '5 players');
expect(pricePerPerson(6) === 20, '6 players');
expect(pricePerPerson(0) === null, 'zero players');
expect(pricePerPerson(-1) === null, 'negative players');
expect(pricePerPerson(4, 0) === null, 'zero slot');
expect(formatPriceAmount(30) === '30', 'integer amount');
expect(formatPriceAmount(40.5) === '40,50', 'decimal amount');
expect(formatPriceAmount(null) === '', 'null amount');
expect(slotPriceFromCopy({ reserver: { calendrier: { prixCreneau: 120 } } }) === 120, 'copy slot');
expect(slotPriceFromCopy({}) === 120, 'missing copy falls back');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
