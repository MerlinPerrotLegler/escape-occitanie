import {
  SLOT_MINUTES,
  hhmmFromParts,
  hourOptions,
  minuteOptions,
  parseHhmm,
  snapMinute,
} from '../src/lib/shortTime.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(SLOT_MINUTES === 30, 'slot step is 30 minutes');
expect(JSON.stringify(parseHhmm('10:00')) === JSON.stringify({ hour: 10, minute: 0 }), 'parses 10:00');
expect(JSON.stringify(parseHhmm('22:30')) === JSON.stringify({ hour: 22, minute: 30 }), 'parses 22:30');
expect(parseHhmm('25:00') === null, 'rejects hour 25');
expect(parseHhmm('10:70') === null, 'rejects minute 70');
expect(parseHhmm('') === null, 'rejects empty');

expect(snapMinute(0) === 0, '0 stays 0');
expect(snapMinute(30) === 30, '30 stays 30');
expect(snapMinute(15) === 0, '15 snaps down to 0');
expect(snapMinute(45) === 30, '45 snaps down to 30');
expect(snapMinute(7, 15) === 0, '7 with step 15 snaps to 0');
expect(snapMinute(20, 15) === 15, '20 with step 15 snaps to 15');

expect(hhmmFromParts(10, 0) === '10:00', 'rebuilds 10:00');
expect(hhmmFromParts(9, 30) === '09:30', 'pads hour');
expect(hhmmFromParts(22, 45) === '22:30', 'snaps minutes when rebuilding');

expect(hourOptions().length === 24, '24 hours');
expect(hourOptions()[0] === '00' && hourOptions()[23] === '23', 'hours 00–23');
expect(minuteOptions().join(',') === '00,30', 'minutes follow the 30-minute step');
expect(minuteOptions(15).join(',') === '00,15,30,45', 'minutes follow a 15-minute step');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
