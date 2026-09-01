# Booking contact validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Valider nom, e-mail et téléphone pendant la saisie du formulaire public de réservation, avec libphonenumber côté navigateur et un filet PHP.

**Architecture:** Fonctions pures + schéma Zod dans `bookingContact.js`. `BookingCalendar` passe sur react-hook-form (`mode: 'onTouched'`) et les messages shadcn `FormMessage`. PHP extrait `mt_validate_guest_*` dans `validate.php` (POST + PATCH). Pas de Composer ; le téléphone PHP n’est qu’un filet (longueur / caractères / 8 chiffres).

**Tech Stack:** React 18, react-hook-form 7, @hookform/resolvers, zod 4, libphonenumber-js/max, shadcn Form, PHP 8.

**Spec:** `docs/superpowers/specs/2026-09-01-booking-contact-validation-design.md`

## Global Constraints

- Ne pas committer sauf demande explicite de l’utilisateur.
- Une seule nouvelle dépendance npm : `libphonenumber-js`. Pas de `react-phone-number-input`, pas de drapeaux.
- Téléphone front : `isValidPhoneNumber(value, 'FR')` depuis `libphonenumber-js/max`.
- Pays par défaut FR ; un `+` reste international.
- Messages exacts : nom `Indiquez un nom (au moins 2 lettres).` ; e-mail `E-mail invalide.` ; téléphone `Numéro de téléphone invalide.`
- Trim avant contrôle. Stockage = valeur trimée, pas de normalisation E.164.
- Nom : 2–120 caractères, lettres Unicode / espaces / `-` / `'` / `’`, au moins 2 lettres.
- E-mail : format + max 190. PHP : `FILTER_VALIDATE_EMAIL`.
- Téléphone PHP : max 40, caractères `+ chiffres espaces - . ()`, au moins 8 chiffres. Pas de libphonenumber PHP.
- Formulaire : `mode: 'onTouched'`, placeholders `Nom` / `E-mail` / `Téléphone`, pas de labels visibles en plus.
- Bouton cliquable sauf pendant `submitting`. Submit invalide : pas d’appel API.
- Hors scope : sélecteur de pays, Composer, flux créneau/joueurs/mails, validation live backoffice.

## File map

Create:

- `apps/web/src/lib/bookingContact.js` — `isGuestName` / `isGuestEmail` / `isGuestPhone` + `bookingContactSchema`
- `apps/web/tools/test-booking-contact.js` — tests CLI Node

Modify:

- `apps/web/package.json` — dépendance `libphonenumber-js`
- `apps/web/public/api/lib/validate.php` — `mt_validate_guest_name` / `_email` / `_phone`
- `apps/web/tools/test-api-lib.php` — assertions sur ces helpers
- `apps/web/public/api/bookings.php` — POST et PATCH utilisent les helpers
- `apps/web/src/components/BookingCalendar.jsx` — RHF + Form shadcn
- `apps/web/src/components/ui/input.jsx` — styles `aria-invalid`

Do not edit `dist/`.

---

### Task 1: Helpers JS + libphonenumber-js + tests

**Files:**

- Create: `apps/web/src/lib/bookingContact.js`
- Create: `apps/web/tools/test-booking-contact.js`
- Modify: `apps/web/package.json` (via npm install)

**Interfaces:**

- Consumes: `libphonenumber-js/max`, `zod`
- Produces:
  - `NAME_ERROR` / `EMAIL_ERROR` / `PHONE_ERROR` (strings)
  - `isGuestName(value: unknown): boolean`
  - `isGuestEmail(value: unknown): boolean`
  - `isGuestPhone(value: unknown): boolean`
  - `bookingContactSchema` — Zod object `{ name, email, phone, players }`

- [ ] **Step 1: Install libphonenumber-js**

From repo root:

```bash
npm install libphonenumber-js -w web
```

Expected: `apps/web/package.json` lists `libphonenumber-js`. Confirm `/max` resolves:

```bash
node -e "import('libphonenumber-js/max').then(m => console.log(typeof m.isValidPhoneNumber))"
```

Expected: `function`

- [ ] **Step 2: Write the failing test**

Create `apps/web/tools/test-booking-contact.js`:

```javascript
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
expect(isGuestEmail(`${'a'.repeat(180)}@x.fr`) === false, 'email over 190');

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
```

If `0612345678` or `+33 6 12 34 56 78` fail against libphonenumber, keep the library as source of truth: pick a number for which `isValidPhoneNumber(n, 'FR') === true` (still a real French mobile/landline) and adjust only that assertion. Do not weaken `isGuestPhone` to a digit count.

- [ ] **Step 3: Run test to verify it fails**

```bash
node apps/web/tools/test-booking-contact.js
```

Expected: FAIL (module not found).

- [ ] **Step 4: Write `bookingContact.js`**

Create `apps/web/src/lib/bookingContact.js`:

```javascript
import { isValidPhoneNumber } from 'libphonenumber-js/max';
import { z } from 'zod';

export const NAME_ERROR = 'Indiquez un nom (au moins 2 lettres).';
export const EMAIL_ERROR = 'E-mail invalide.';
export const PHONE_ERROR = 'Numéro de téléphone invalide.';

const NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M}\s'\u2019-]*$/u;

export function isGuestName(value) {
  const name = String(value ?? '').trim();
  if (name.length < 2 || name.length > 120) return false;
  if (!NAME_CHARS.test(name)) return false;
  const letters = name.match(/\p{L}/gu);
  return Boolean(letters && letters.length >= 2);
}

export function isGuestEmail(value) {
  const email = String(value ?? '').trim();
  if (email.length === 0 || email.length > 190) return false;
  return z.email().safeParse(email).success;
}

export function isGuestPhone(value) {
  const phone = String(value ?? '').trim();
  if (phone.length === 0 || phone.length > 40) return false;
  return isValidPhoneNumber(phone, 'FR');
}

export const bookingContactSchema = z.object({
  name: z.string().trim().refine(isGuestName, NAME_ERROR),
  email: z.string().trim().refine(isGuestEmail, EMAIL_ERROR),
  phone: z.string().trim().refine(isGuestPhone, PHONE_ERROR),
  players: z.coerce.number().int().min(3).max(6),
});
```

If Zod 4 in this repo does not export `z.email()`, replace `isGuestEmail` with:

```javascript
return z.string().email().safeParse(email).success;
```

- [ ] **Step 5: Run tests and make sure they pass**

```bash
node apps/web/tools/test-booking-contact.js
```

Expected: `OK`

- [ ] **Step 6: Commit**

Skip unless the user explicitly asks.

---

### Task 2: Helpers PHP + POST/PATCH bookings

**Files:**

- Modify: `apps/web/public/api/lib/validate.php` (append after existing functions)
- Modify: `apps/web/tools/test-api-lib.php`
- Modify: `apps/web/public/api/bookings.php`

**Interfaces:**

- Consumes: nothing new (no Composer)
- Produces:
  - `mt_validate_guest_name(string $name): array{ok:bool,error:?string,value:?string}`
  - `mt_validate_guest_email(string $email): array{ok:bool,error:?string,value:?string}`
  - `mt_validate_guest_phone(string $phone): array{ok:bool,error:?string,value:?string}`

- [ ] **Step 1: Write the failing PHP assertions**

In `apps/web/tools/test-api-lib.php`, after the existing `mt_validate_content` expects (around the `$bad = mt_validate_content` block is fine; append before `require $root . '/schedule.php'`):

```php
$okName = mt_validate_guest_name('Jean-Luc');
expect(($okName['ok'] ?? false) === true && $okName['value'] === 'Jean-Luc', 'php name hyphen');
$okCurly = mt_validate_guest_name("O’Brien");
expect(($okCurly['ok'] ?? false) === true, 'php name curly apostrophe');
$trimName = mt_validate_guest_name('  Marie Claire  ');
expect(($trimName['ok'] ?? false) === true && $trimName['value'] === 'Marie Claire', 'php name trim');
$short = mt_validate_guest_name('A');
expect(($short['ok'] ?? false) === false && $short['error'] === 'Indiquez un nom (au moins 2 lettres).', 'php name too short');
$punct = mt_validate_guest_name('--');
expect(($punct['ok'] ?? false) === false, 'php name punctuation');
$digits = mt_validate_guest_name('123');
expect(($digits['ok'] ?? false) === false, 'php name digits');

$okMail = mt_validate_guest_email('  paul@example.com  ');
expect(($okMail['ok'] ?? false) === true && $okMail['value'] === 'paul@example.com', 'php email trim');
$badMail = mt_validate_guest_email('not-an-email');
expect(($badMail['ok'] ?? false) === false && $badMail['error'] === 'E-mail invalide.', 'php email invalid');

$okPhone = mt_validate_guest_phone('+33 6 12 34 56 78');
expect(($okPhone['ok'] ?? false) === true && $okPhone['value'] === '+33 6 12 34 56 78', 'php phone keeps formatting');
$shortPhone = mt_validate_guest_phone('1234');
expect(($shortPhone['ok'] ?? false) === false && $shortPhone['error'] === 'Numéro de téléphone invalide.', 'php phone short');
$lettersPhone = mt_validate_guest_phone('abc');
expect(($lettersPhone['ok'] ?? false) === false, 'php phone letters');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
php apps/web/tools/test-api-lib.php
```

Expected: FAIL (`mt_validate_guest_name` undefined).

- [ ] **Step 3: Add helpers at the end of `apps/web/public/api/lib/validate.php`**

```php
function mt_validate_guest_name(string $name): array {
    $name = trim($name);
    $letters = preg_match_all('/\p{L}/u', $name);
    $okChars = (bool) preg_match("/^[\\p{L}\\p{M}][\\p{L}\\p{M}\\s'\\x{2019}-]*$/u", $name);
    if ($name === '' || mb_strlen($name) > 120 || $letters < 2 || !$okChars) {
        return ['ok' => false, 'error' => 'Indiquez un nom (au moins 2 lettres).', 'value' => null];
    }
    return ['ok' => true, 'error' => null, 'value' => $name];
}

function mt_validate_guest_email(string $email): array {
    $email = trim($email);
    if ($email === '' || mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'E-mail invalide.', 'value' => null];
    }
    return ['ok' => true, 'error' => null, 'value' => $email];
}

function mt_validate_guest_phone(string $phone): array {
    $phone = trim($phone);
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if (
        $phone === ''
        || mb_strlen($phone) > 40
        || !preg_match('/^[0-9+\s().\-]+$/', $phone)
        || strlen($digits) < 8
    ) {
        return ['ok' => false, 'error' => 'Numéro de téléphone invalide.', 'value' => null];
    }
    return ['ok' => true, 'error' => null, 'value' => $phone];
}
```

- [ ] **Step 4: Wire POST and PATCH in `apps/web/public/api/bookings.php`**

Replace the PATCH name/email/phone checks and field assignment with:

```php
        $name = isset($body['name']) ? trim((string) $body['name']) : null;
        $email = isset($body['email']) ? trim((string) $body['email']) : null;
        $phone = isset($body['phone']) ? trim((string) $body['phone']) : null;
        $players = array_key_exists('players', $body) ? (int) $body['players'] : null;
        if ($name !== null) {
            $checked = mt_validate_guest_name($name);
            if (!$checked['ok']) {
                mt_json_out(400, ['error' => $checked['error']]);
            }
            $name = $checked['value'];
        }
        if ($email !== null) {
            $checked = mt_validate_guest_email($email);
            if (!$checked['ok']) {
                mt_json_out(400, ['error' => $checked['error']]);
            }
            $email = $checked['value'];
        }
        if ($phone !== null) {
            $checked = mt_validate_guest_phone($phone);
            if (!$checked['ok']) {
                mt_json_out(400, ['error' => $checked['error']]);
            }
            $phone = $checked['value'];
        }
        if ($players !== null && ($players < 3 || $players > 6)) {
            mt_json_out(400, ['error' => 'Entre 3 et 6 joueurs.']);
        }
```

Replace the POST name/email/phone checks with:

```php
    $checkedName = mt_validate_guest_name($name);
    if (!$checkedName['ok']) {
        mt_json_out(400, ['error' => $checkedName['error']]);
    }
    $name = $checkedName['value'];
    $checkedEmail = mt_validate_guest_email($email);
    if (!$checkedEmail['ok']) {
        mt_json_out(400, ['error' => $checkedEmail['error']]);
    }
    $email = $checkedEmail['value'];
    $checkedPhone = mt_validate_guest_phone($phone);
    if (!$checkedPhone['ok']) {
        mt_json_out(400, ['error' => $checkedPhone['error']]);
    }
    $phone = $checkedPhone['value'];
```

Keep the existing room/date/time/players checks. `mt_create_booking` already receives `$name` / `$email` / `$phone`.

- [ ] **Step 5: Run PHP tests**

```bash
php apps/web/tools/test-api-lib.php
```

Expected: `OK`

- [ ] **Step 6: Commit**

Skip unless the user explicitly asks.

---

### Task 3: Formulaire `BookingCalendar`

**Files:**

- Modify: `apps/web/src/components/ui/input.jsx`
- Modify: `apps/web/src/components/BookingCalendar.jsx`

**Interfaces:**

- Consumes: `bookingContactSchema` from `@/lib/bookingContact`
- Produces: formulaire public avec erreurs sous les champs ; `createBooking` n’est appelé que si le schéma passe

- [ ] **Step 1: Invalid styles on `Input`**

In `apps/web/src/components/ui/input.jsx`, add to the `className` string (keep existing classes):

```
aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/40
```

- [ ] **Step 2: Wire react-hook-form**

In `apps/web/src/components/BookingCalendar.jsx`:

Add imports:

```javascript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { bookingContactSchema } from '@/lib/bookingContact';
```

Remove:

```javascript
const [form, setForm] = useState({ name: '', email: '', phone: '', players: 4 });
```

Add (inside the component, with the other hooks):

```javascript
  const contactForm = useForm({
    resolver: zodResolver(bookingContactSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', phone: '', players: 4 },
  });
```

Replace `onSubmit` with:

```javascript
  async function onSubmit(values) {
    if (!selectedISO || !selectedSlot) return;
    setSubmitting(true);
    try {
      const result = await createBooking({
        room: room.slug,
        date: selectedISO,
        time: selectedSlot,
        name: values.name,
        email: values.email,
        phone: values.phone,
        players: Number(values.players),
      });
      setDone(result.booking);
      toast.success(
        result.emailSent
          ? 'Demande envoyée. Un e-mail vous a été envoyé.'
          : 'Demande envoyée, en attente de confirmation.'
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }
```

Replace the `<form>...</form>` block with:

```javascript
            {selectedSlot && (
              <Form {...contactForm}>
                <form
                  onSubmit={contactForm.handleSubmit(onSubmit)}
                  className="mt-5 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
                  noValidate
                >
                  <p className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-primary">
                    <CalendarCheck className="h-4 w-4" />
                    {dayFormatter.format(selectedDate)} à {selectedSlot} — 60 min
                  </p>
                  <FormField
                    control={contactForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Nom" autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="email" placeholder="E-mail" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input type="tel" placeholder="Téléphone" autoComplete="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="players"
                    render={({ field }) => (
                      <FormItem>
                        <label className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-primary" />
                          Joueurs
                          <select
                            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          >
                            {[3, 4, 5, 6].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={submitting} className="h-11 w-full">
                    Réserver ce créneau
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Un e-mail d’accusé de réception sera envoyé. Confirmation par l’équipe ensuite. Une
                    question ? {CONTACT.phone}
                  </p>
                </form>
              </Form>
            )}
```

`noValidate` disables native HTML5 bubbles so only `FormMessage` shows. Do not add `required`. Do not disable the button when the form is invalid.

- [ ] **Step 3: Sanity-check tests still pass**

```bash
node apps/web/tools/test-booking-contact.js
php apps/web/tools/test-api-lib.php
```

Expected: `OK` twice.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks.

---

### Task 4: Vérification navigateur

**Files:** none (manual / browser tools)

- [ ] **Step 1: App running**

`npm run dev` already proxies `/api`. Open a room booking page (ex. `/reservation/le-directeur` or the route used in `App.jsx`). Pick a slot so the form appears.

- [ ] **Step 2: Invalid submit — no network booking**

Leave fields empty, click « Réserver ce créneau ». Expect the three messages under the fields. Confirm no `POST /api/bookings.php`.

- [ ] **Step 3: onTouched then onChange**

Type `A` in Nom, blur: message nom. Continue to `Anne` : message disparaît. Same for `x` then a valid e-mail, and `1234` then `0612345678`.

- [ ] **Step 4: Valid submit still works**

Fill valid nom / e-mail / téléphone / joueurs, submit. Expect the existing success screen or toast (pending booking). If SMTP is off, toast « en attente de confirmation » is OK.

If a step fails, fix then re-verify that step and the ones around it.
