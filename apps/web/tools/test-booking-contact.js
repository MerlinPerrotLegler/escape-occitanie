import {
  EMAIL_ERROR,
  NAME_ERROR,
  PHONE_ERROR,
  bookingContactSchema,
  isGuestEmail,
  isGuestName,
  isGuestPhone,
} from '../src/lib/bookingContact.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(isGuestName('Jean-Luc') === true, 'hyphenated given name');
expect(isGuestName("O’Brien") === true, 'curly apostrophe');
expect(isGuestName('Marie Claire') === true, 'space');
expect(isGuestName('  Marie  ') === true, 'trim then valid');
expect(isGuestName('A') === false, 'single letter');
expect(isGuestName('--') === false, 'punctuation only');
expect(isGuestName('123') === false, 'digits only');
expect(isGuestName('') === false, 'empty name');

expect(isGuestEmail('paul@example.com') === true, 'plain email');
expect(isGuestEmail('  paul@example.com  ') === true, 'trimmed email');
expect(isGuestEmail('not-an-email') === false, 'missing @');
expect(isGuestEmail('') === false, 'empty email');
expect(isGuestEmail(`${'a'.repeat(186)}@x.fr`) === false, 'email over 190');

expect(isGuestPhone('0612345678') === true, 'FR national');
expect(isGuestPhone('+33 6 12 34 56 78') === true, 'FR international');
expect(isGuestPhone('+447911123456') === true, 'UK international');
expect(isGuestPhone('abc') === false, 'letters');
expect(isGuestPhone('1234') === false, 'too short');
expect(isGuestPhone('1111111111') === false, 'invalid pattern');
expect(isGuestPhone('') === false, 'empty phone');

const bad = bookingContactSchema.safeParse({ name: 'A', email: 'x', phone: '1', players: 4 });
expect(bad.success === false, 'schema rejects invalid contact');
if (!bad.success) {
  const byPath = Object.fromEntries(bad.error.issues.map((i) => [i.path.join('.'), i.message]));
  expect(byPath.name === NAME_ERROR, 'name message');
  expect(byPath.email === EMAIL_ERROR, 'email message');
  expect(byPath.phone === PHONE_ERROR, 'phone message');
}

const good = bookingContactSchema.safeParse({
  name: 'Marie Claire',
  email: 'marie@example.com',
  phone: '0612345678',
  players: 4,
});
expect(good.success === true, 'schema accepts valid contact');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
