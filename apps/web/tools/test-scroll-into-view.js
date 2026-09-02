import { HEADER_SCROLL_OFFSET, scrollNodeIntoView } from '../src/lib/scrollIntoView.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

const calls = [];
const windowObj = {
  scrollY: 800,
  scrollTo(opts) {
    calls.push(opts);
  },
};

scrollNodeIntoView(null, windowObj);
expect(calls.length === 0, 'null node does not scroll');

scrollNodeIntoView({ getBoundingClientRect: () => ({ top: -420 }) }, windowObj);
expect(calls.length === 1, 'scrolls when confirmation is above the viewport');
expect(calls[0].behavior === 'smooth', 'smooth behavior');
expect(
  calls[0].top === 800 - 420 - HEADER_SCROLL_OFFSET,
  `scrolls up by confirmation offset (got ${calls[0].top})`
);
expect(calls[0].top >= 0, 'does not scroll above document top');

scrollNodeIntoView({ getBoundingClientRect: () => ({ top: 900 }) }, windowObj, 96);
expect(calls[1].top === 800 + 900 - 96, 'scrolls down when confirmation is below');

if (failed) {
  process.stderr.write(`${failed} failed\n`);
  process.exit(1);
}
process.stdout.write('OK\n');
