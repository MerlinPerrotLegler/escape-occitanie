# Demander un avis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filtre Avis dans Maître Thibault, boutons manuels pour envoyer un lien d’avis (mail ou copie), page publique Google / Facebook / Instagram avec partage aux autres joueurs.

**Architecture:** Colonne `bookings.review_ask` + flags calculés (`past_actions`, `can_ask_review`, `review_url`). Le lendemain calendaire de `booking_date` (Paris) verrouille l’édition et ouvre les boutons d’avis. Le mail et « Copier le lien » pointent vers `GET /api/avis.php?b=&t=` (HMAC comme `calendar.php`). Template MJML `client-avis` : un seul CTA.

**Tech Stack:** PHP 8, MySQL, MJML via compile contribution, React 18, Vite.

**Spec:** `docs/superpowers/specs/2026-09-02-review-ask-email-design.md`

## Global Constraints

- Ne pas committer sauf demande explicite de l’utilisateur (ignorer les steps Commit).
- Ne pas modifier `dist/`.
- Fuseau Europe/Paris. Seuil = `booking_date < mt_today_paris()` (pas `created_at`, pas `start_minute`).
- Filtre Avis = confirmée + `review_ask IS NULL` + date d’hier ou avant.
- Mail = un lien vers la page, pas les trois URL sociales. Pas d’ICS.
- WhatsApp hors scope. Pas de cron. Pas de libellé d’état avis. Pas de pastille sur le filtre.
- PATCH / DELETE / resend API inchangés. Confirmer un pending ancien reste possible.
- `TAB_ALIASES.avis = 'records'` reste (onglet hash `#avis`). Le filtre est `?filtre=avis` sur `#reservations`. Ne pas coller les deux.

## File map

Create:

- `contribution/emails/client-avis.mjml` — mail un bouton
- `apps/web/public/api/avis.php` — page publique
- `apps/web/tools/test-review-ask.php` — tests DB filtre / mark

Modify:

- `apps/web/public/api/lib/db.php` — colonne `review_ask`
- `apps/web/public/api/lib/calendar.php` — token + URL avis
- `apps/web/public/api/lib/booking.php` — select, map, filtre, mark
- `apps/web/public/api/lib/mail.php` — `{lien_avis}`, kind `review`, HTML page, filet texte
- `apps/web/public/api/bookings.php` — GET passe `$env` ; POST `review-ask` / `review-skip`
- `contribution/contact.xml` — `<avis-google>`
- `contribution/emails.xml` — `client-avis`
- `apps/web/tools/compile-contribution.js` — `EMAIL_IDS` + parse `avis-google`
- `apps/web/tools/test-compile-contribution.js` — fixture
- `apps/web/tools/test-api-lib.php` — helpers + token
- `apps/web/tools/test-mail-copy.php` — sujet / `{lien_avis}`
- `apps/web/src/lib/reservationsHash.js` — filtre `avis`
- `apps/web/tools/test-reservations-hash.js`
- `apps/web/src/lib/booking.js` — clients ask / skip
- `apps/web/src/pages/MaitreThibaultPage.jsx` — boutons + filtre

---

### Task 1: Schema + helpers PHP (sans I/O mail)

**Files:**

- Modify: `apps/web/public/api/lib/db.php`
- Modify: `apps/web/public/api/lib/calendar.php`
- Modify: `apps/web/public/api/lib/booking.php`
- Modify: `apps/web/tools/test-api-lib.php`

**Interfaces:**

- Consumes: `mt_today_paris()`, `mt_public_base()`, `hash_hmac` comme `mt_calendar_token`
- Produces:
  - `mt_normalize_review_ask(mixed $raw): ?string` — `'sent'` \| `'skipped'` \| `null`
  - `mt_booking_past_actions(array $booking, ?string $today = null): bool`
  - `mt_booking_can_ask_review(array $booking, ?string $today = null): bool`
  - `mt_review_token(array $env, int $bookingId, string $email): string`
  - `mt_review_token_ok(array $env, int $bookingId, string $email, string $token): bool`
  - `mt_review_page_url(array $env, array $booking): string`
  - colonne `bookings.review_ask VARCHAR(16) NULL`

- [ ] **Step 1: Write the failing tests**

In `apps/web/tools/test-api-lib.php`, after the manager-confirm token expects (around the `$mgrLinks` block), append:

```php
$today = '2026-09-02';
$baseBooking = [
    'booking_date' => '2026-09-01',
    'status' => 'confirmed',
    'review_ask' => null,
    'id' => 42,
    'guest_email' => 'paul@example.com',
];
expect(mt_booking_past_actions($baseBooking, $today) === true, 'yesterday is past');
expect(mt_booking_past_actions(array_merge($baseBooking, ['booking_date' => '2026-09-02']), $today) === false, 'today is not past');
expect(mt_booking_past_actions(array_merge($baseBooking, ['booking_date' => '2026-09-03']), $today) === false, 'future is not past');
expect(mt_booking_can_ask_review($baseBooking, $today) === true, 'confirmed yesterday can ask');
expect(mt_booking_can_ask_review(array_merge($baseBooking, ['status' => 'pending']), $today) === false, 'pending cannot ask');
expect(mt_booking_can_ask_review(array_merge($baseBooking, ['status' => 'cancelled']), $today) === false, 'cancelled cannot ask');
expect(mt_booking_can_ask_review(array_merge($baseBooking, ['review_ask' => 'sent']), $today) === false, 'sent cannot ask');
expect(mt_booking_can_ask_review(array_merge($baseBooking, ['review_ask' => 'skipped']), $today) === false, 'skipped cannot ask');
expect(mt_booking_can_ask_review(array_merge($baseBooking, ['booking_date' => '2026-09-02']), $today) === false, 'today cannot ask');
expect(mt_normalize_review_ask(null) === null, 'null ask');
expect(mt_normalize_review_ask('') === null, 'empty ask');
expect(mt_normalize_review_ask('sent') === 'sent', 'sent ask');
expect(mt_normalize_review_ask('skipped') === 'skipped', 'skipped ask');
expect(mt_normalize_review_ask('nope') === null, 'unknown ask');

$reviewToken = mt_review_token($envCal, 42, 'paul@example.com');
expect($reviewToken !== '', 'review token issued');
expect(mt_review_token_ok($envCal, 42, 'paul@example.com', $reviewToken) === true, 'review token ok');
expect(mt_review_token_ok($envCal, 42, 'other@example.com', $reviewToken) === false, 'review token rejects other email');
expect(mt_review_token_ok($envCal, 41, 'paul@example.com', $reviewToken) === false, 'review token rejects other booking');
$reviewUrl = mt_review_page_url($envCal, $baseBooking);
expect(str_contains($reviewUrl, '/api/avis.php?b=42'), 'review url path');
expect(str_contains($reviewUrl, 't='), 'review url has token');
```

`$envCal` is already defined just above in this file.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
php apps/web/tools/test-api-lib.php
```

Expected: FAIL `mt_booking_past_actions` / `Call to undefined function`.

- [ ] **Step 3: Schema**

In `apps/web/public/api/lib/db.php`, add `review_ask VARCHAR(16) NULL` to the `CREATE TABLE bookings` DDL (after `ics_sequence`, before `created_at`). After the `ics_sequence` ALTER block, add:

```php
if (!mt_table_has_column($pdo, 'bookings', 'review_ask')) {
    $pdo->exec('ALTER TABLE bookings ADD COLUMN review_ask VARCHAR(16) NULL');
}
```

- [ ] **Step 4: Token + URL**

In `apps/web/public/api/lib/calendar.php`, after `mt_manager_confirm_token_ok`:

```php
function mt_review_token(array $env, int $bookingId, string $email): string {
    $secret = (string) ($env['AUTH_SECRET'] ?? '');
    return substr(hash_hmac('sha256', 'avis|' . $bookingId . '|' . strtolower($email), $secret), 0, 20);
}

function mt_review_token_ok(array $env, int $bookingId, string $email, string $token): bool {
    if ($token === '' || $bookingId < 1) {
        return false;
    }
    $expected = mt_review_token($env, $bookingId, $email);
    return hash_equals($expected, $token);
}

function mt_review_page_url(array $env, array $booking): string {
    $id = (int) ($booking['id'] ?? 0);
    $email = (string) ($booking['guest_email'] ?? '');
    $token = $id > 0 ? mt_review_token($env, $id, $email) : '';
    return mt_public_base($env) . '/api/avis.php?b=' . $id . '&t=' . rawurlencode($token);
}
```

- [ ] **Step 5: Eligibility helpers**

In `apps/web/public/api/lib/booking.php`, after `mt_today_paris`:

```php
function mt_normalize_review_ask(mixed $raw): ?string {
    $value = strtolower(trim((string) $raw));
    if ($value === 'sent' || $value === 'skipped') {
        return $value;
    }
    return null;
}

function mt_booking_past_actions(array $booking, ?string $today = null): bool {
    $today = $today ?? mt_today_paris();
    $date = (string) ($booking['booking_date'] ?? '');
    return $date !== '' && $date < $today;
}

function mt_booking_can_ask_review(array $booking, ?string $today = null): bool {
    if (($booking['status'] ?? '') !== 'confirmed') {
        return false;
    }
    if (mt_normalize_review_ask($booking['review_ask'] ?? null) !== null) {
        return false;
    }
    return mt_booking_past_actions($booking, $today);
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
php apps/web/tools/test-api-lib.php
```

Expected: `OK`

- [ ] **Step 7: Commit**

Skip unless the user asked to commit.

```bash
git add apps/web/public/api/lib/db.php apps/web/public/api/lib/calendar.php apps/web/public/api/lib/booking.php apps/web/tools/test-api-lib.php
git commit -m "$(cat <<'EOF'
Add review-ask eligibility helpers and bookings.review_ask column.

EOF
)"
```

---

### Task 2: Liste + flags sur chaque réservation

**Files:**

- Modify: `apps/web/public/api/lib/booking.php`
- Modify: `apps/web/public/api/bookings.php`
- Create: `apps/web/tools/test-review-ask.php`

**Interfaces:**

- Consumes: helpers Task 1, `mt_today_paris()`
- Produces:
  - `mt_normalize_booking_filter` accepte `'avis'`
  - `mt_booking_select_sql` inclut `review_ask`
  - `mt_map_booking_rows(array $rows, ?array $env = null, ?string $today = null): array` ajoute `review_ask`, `past_actions`, `can_ask_review`, `review_url`
  - `mt_get_booking(PDO $pdo, int $id, ?array $env = null): ?array`
  - `mt_list_bookings_page(..., ?array $env = null): array` filtre SQL avis
  - GET `bookings.php` passe `$env`

- [ ] **Step 1: Write the failing DB test**

Create `apps/web/tools/test-review-ask.php`:

```php
<?php
declare(strict_types=1);

require dirname(__DIR__) . '/public/api/bootstrap.php';

$failed = 0;
function expect($cond, $msg) {
    global $failed;
    if (!$cond) {
        fwrite(STDERR, "FAIL: $msg\n");
        $failed++;
    }
}

$env = mt_boot();
$pdo = mt_pdo($env);
mt_ensure_schema($pdo);
expect(mt_table_has_column($pdo, 'bookings', 'review_ask'), 'review_ask column exists');

$today = mt_today_paris();
$yesterday = (new DateTimeImmutable($today, new DateTimeZone('Europe/Paris')))
    ->modify('-1 day')
    ->format('Y-m-d');
$tomorrow = (new DateTimeImmutable($today, new DateTimeZone('Europe/Paris')))
    ->modify('+1 day')
    ->format('Y-m-d');

$stamp = 'rev-' . bin2hex(random_bytes(4));
$insert = $pdo->prepare('INSERT INTO bookings (room_slug, booking_date, start_minute, duration_minutes, guest_name, guest_email, guest_phone, players, status, review_ask) VALUES (?,?,?,?,?,?,?,?,?,?)');

$insert->execute(['directeur', $yesterday, 840, 60, $stamp, 'ada@example.com', '0612345678', 4, 'confirmed', null]);
$eligibleId = (int) $pdo->lastInsertId();
$insert->execute(['directeur', $yesterday, 900, 60, $stamp, 'bob@example.com', '0612345678', 4, 'confirmed', 'sent']);
$sentId = (int) $pdo->lastInsertId();
$insert->execute(['directeur', $today, 840, 60, $stamp, 'cara@example.com', '0612345678', 4, 'confirmed', null]);
$todayId = (int) $pdo->lastInsertId();
$insert->execute(['directeur', $yesterday, 960, 60, $stamp, 'dan@example.com', '0612345678', 4, 'pending', null]);
$pendingId = (int) $pdo->lastInsertId();

try {
    expect(mt_normalize_booking_filter('avis') === 'avis', 'normalize avis');
    $page = mt_list_bookings_page($pdo, 'avis', 1, null, $env);
    expect($page['filtre'] === 'avis', 'filtre echoed');
    $ids = array_map(fn($row) => (int) $row['id'], $page['bookings']);
    expect(in_array($eligibleId, $ids, true), 'eligible in avis');
    expect(!in_array($sentId, $ids, true), 'sent excluded');
    expect(!in_array($todayId, $ids, true), 'today excluded');
    expect(!in_array($pendingId, $ids, true), 'pending excluded');

    $row = mt_get_booking($pdo, $eligibleId, $env);
    expect($row['review_ask'] === null, 'eligible review_ask null');
    expect($row['past_actions'] === true, 'eligible past_actions');
    expect($row['can_ask_review'] === true, 'eligible can_ask');
    expect(str_contains((string) $row['review_url'], '/api/avis.php?b=' . $eligibleId), 'review_url');

    $todayRow = mt_get_booking($pdo, $todayId, $env);
    expect($todayRow['past_actions'] === false, 'today not past');
    expect($todayRow['can_ask_review'] === false, 'today cannot ask');

    $pendingRow = mt_get_booking($pdo, $pendingId, $env);
    expect($pendingRow['past_actions'] === true, 'pending yesterday is past');
    expect($pendingRow['can_ask_review'] === false, 'pending cannot ask');
} finally {
    $pdo->prepare("DELETE FROM bookings WHERE guest_name = ?")->execute([$stamp]);
}

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
php apps/web/tools/test-review-ask.php
```

Expected: FAIL on column and/or `avis` filter / extra args.

- [ ] **Step 3: Wire select, map, filter**

`mt_booking_select_sql` — add `review_ask` after `ics_sequence`.

Replace `mt_map_booking_rows` / `mt_get_booking`:

```php
function mt_map_booking_rows(array $rows, ?array $env = null, ?string $today = null): array {
    $today = $today ?? mt_today_paris();
    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['start_minute'] = (int) $row['start_minute'];
        $row['players'] = (int) $row['players'];
        $row['ics_sequence'] = (int) ($row['ics_sequence'] ?? 0);
        $row['duration_minutes'] = mt_booking_duration($row);
        $row['time'] = mt_minutes_to_hhmm($row['start_minute']);
        $row['end_time'] = mt_minutes_to_hhmm($row['start_minute'] + $row['duration_minutes']);
        $row['review_ask'] = mt_normalize_review_ask($row['review_ask'] ?? null);
        $row['past_actions'] = mt_booking_past_actions($row, $today);
        $row['can_ask_review'] = mt_booking_can_ask_review($row, $today);
        $row['review_url'] = '';
        if (($row['status'] ?? '') === 'confirmed' && is_array($env)) {
            $row['review_url'] = mt_review_page_url($env, $row);
        }
    }
    return $rows;
}

function mt_get_booking(PDO $pdo, int $id, ?array $env = null): ?array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT ' . mt_booking_select_sql() . ' FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? mt_map_booking_rows([$row], $env)[0] : null;
}
```

In `mt_normalize_booking_filter`, after the `toutes` check:

```php
if (in_array($value, ['avis', 'reviews'], true)) {
    return 'avis';
}
```

`mt_list_bookings_page` — add 5th arg `?array $env = null`. In the where block:

```php
} elseif ($filter === 'avis') {
    $where[] = "status = 'confirmed'";
    $where[] = 'review_ask IS NULL';
    $where[] = 'booking_date < ?';
    $args[] = mt_today_paris();
}
```

Order: `avis` uses the same `ORDER BY booking_date DESC, start_minute DESC, id DESC` as `toutes` (the existing `else` branch). Pass `$env` into `mt_map_booking_rows($stmt->fetchAll(), $env)`.

Call sites of `mt_list_bookings` / `mt_map_booking_rows` without `$env` keep working (optional arg).

- [ ] **Step 4: GET bookings.php**

Change the GET handler to:

```php
mt_json_out(200, mt_list_bookings_page($pdo, $filter, $page, $focus > 0 ? $focus : null, $env));
```

Any other `mt_get_booking($pdo, $id)` in this file that returns JSON to the manager should pass `$env` so `review_url` is present (confirm / mail / ask responses).

- [ ] **Step 5: Run tests — expect PASS**

```bash
php apps/web/tools/test-review-ask.php
php apps/web/tools/test-api-lib.php
php apps/web/tools/test-booking-settings.php
```

Expected: all `OK`

- [ ] **Step 6: Commit**

Skip unless the user asked to commit.

---

### Task 3: POST `review-ask` / `review-skip`

**Files:**

- Modify: `apps/web/public/api/lib/booking.php`
- Modify: `apps/web/public/api/bookings.php`
- Modify: `apps/web/tools/test-review-ask.php`

**Interfaces:**

- Consumes: `mt_booking_can_ask_review`, `mt_send_mail` (wired in Task 4; this task may call a helper that Task 4 fills)
- Produces:
  - `mt_mark_review_ask(PDO $pdo, int $id, string $value): bool` — `UPDATE … WHERE review_ask IS NULL`, `$value` in `sent`/`skipped`
  - `POST /api/bookings.php?id={id}&action=review-ask`
  - `POST /api/bookings.php?id={id}&action=review-skip`

- [ ] **Step 1: Extend DB test for mark**

In `apps/web/tools/test-review-ask.php` `try` block, after the `pendingRow` expects:

```php
expect(mt_mark_review_ask($pdo, $eligibleId, 'skipped') === true, 'first skip marks');
expect(mt_get_booking($pdo, $eligibleId, $env)['review_ask'] === 'skipped', 'skipped persisted');
expect(mt_mark_review_ask($pdo, $eligibleId, 'sent') === false, 'second mark fails');

$insert->execute(['directeur', $yesterday, 1020, 60, $stamp, 'eve@example.com', '0612345678', 4, 'confirmed', null]);
$secondId = (int) $pdo->lastInsertId();
expect(mt_mark_review_ask($pdo, $secondId, 'sent') === true, 'sent marks');
expect(mt_get_booking($pdo, $secondId, $env)['can_ask_review'] === false, 'sent cannot ask');
```

- [ ] **Step 2: Run — expect FAIL** (`mt_mark_review_ask` missing)

```bash
php apps/web/tools/test-review-ask.php
```

- [ ] **Step 3: Implement mark**

In `booking.php`:

```php
function mt_mark_review_ask(PDO $pdo, int $id, string $value): bool {
    $value = mt_normalize_review_ask($value);
    if ($id < 1 || $value === null) {
        return false;
    }
    $stmt = $pdo->prepare('UPDATE bookings SET review_ask = ? WHERE id = ? AND review_ask IS NULL');
    $stmt->execute([$value, $id]);
    return $stmt->rowCount() === 1;
}
```

- [ ] **Step 4: Wire POST in `bookings.php`**

Extend the existing POST `id` + `action` condition to also accept `review-ask` and `review-skip`. Keep confirm/mail as they are. After that block (or as extra branches), add:

```php
if ($method === 'POST' && isset($_GET['id']) && in_array((string) ($_GET['action'] ?? ''), ['review-ask', 'review-skip'], true)) {
    mt_require_session($env);
    $id = (int) $_GET['id'];
    $action = (string) $_GET['action'];
    $booking = mt_get_booking($pdo, $id, $env);
    if (!$booking) {
        mt_json_out(404, ['error' => 'Réservation introuvable.']);
    }
    if (!mt_booking_can_ask_review($booking)) {
        mt_json_out(400, ['error' => 'Cette réservation n’est pas éligible pour un avis.']);
    }
    if ($action === 'review-skip') {
        if (!mt_mark_review_ask($pdo, $id, 'skipped')) {
            mt_json_out(409, ['error' => 'Décision déjà enregistrée.']);
        }
        mt_json_out(200, ['booking' => mt_get_booking($pdo, $id, $env)]);
    }
    $emailSent = false;
    try {
        $emailSent = mt_send_review_email($env, $booking);
    } catch (Throwable $ignored) {
        $emailSent = false;
    }
    if ($emailSent && !mt_mark_review_ask($pdo, $id, 'sent')) {
        mt_json_out(409, ['error' => 'Décision déjà enregistrée.', 'emailSent' => true, 'booking' => mt_get_booking($pdo, $id, $env)]);
    }
    mt_json_out(200, ['booking' => mt_get_booking($pdo, $id, $env), 'emailSent' => $emailSent]);
}
```

Add a temporary stub in `mail.php` so this compiles before Task 4 (or implement Task 4 immediately after). Stub:

```php
function mt_send_review_email(array $env, array $booking): bool {
    return false;
}
```

Task 4 replaces the stub with a real send. The mark-on-success rule is already correct with the stub (tests of mark are independent).

- [ ] **Step 5: Run tests**

```bash
php apps/web/tools/test-review-ask.php
php apps/web/tools/test-api-lib.php
```

Expected: `OK`

- [ ] **Step 6: Commit**

Skip unless the user asked to commit.

---

### Task 4: Copy contribution + mail `client-avis`

**Files:**

- Modify: `contribution/contact.xml`
- Modify: `contribution/emails.xml`
- Create: `contribution/emails/client-avis.mjml`
- Modify: `apps/web/tools/compile-contribution.js`
- Modify: `apps/web/tools/test-compile-contribution.js`
- Modify: `apps/web/public/api/lib/mail.php`
- Modify: `apps/web/tools/test-mail-copy.php`

**Interfaces:**

- Consumes: `mt_review_page_url`, `mt_fill_copy`, `mt_send_mail`
- Produces:
  - `contact.reviewGoogle` (JSON) / `avisGoogle` parse key `avis-google`
  - `copy.emails['client-avis']` `{ sujet, html, texte }`
  - `mt_booking_copy_vars` keys `lien_avis`, `lien_avis_google`, `lien_facebook`, `lien_instagram`
  - `mt_booking_email_parts(..., 'review')`
  - `mt_send_review_email(array $env, array $booking): bool`
  - fallback `mt_review_customer_email`

- [ ] **Step 1: Failing compile + mail tests**

In `apps/web/tools/compile-contribution.js`:

- `EMAIL_IDS` becomes `['client-attente', 'client-confirmee', 'manager-nouvelle', 'client-avis']`
- In `parseContact`, add `reviewGoogle: reqStr(file, node, 'avis-google')`

In `writeMinimal` of `test-compile-contribution.js`:

- add `<avis-google>https://g.example/review</avis-google>` inside `contact.xml`
- add a fourth `<mail id="client-avis">` and include `'client-avis'` in the mjml loop

Add an assertion after the existing email expects:

```javascript
expect(copy.contact.reviewGoogle === 'https://g.example/review', 'avis-google');
expect(copy.emails['client-avis'].sujet === 'Avis', 'client-avis sujet');
```

(Use sujet `Avis` in the fixture mail, not the production subject.)

In `test-mail-copy.php`, inside the `site-copy.json` present branch, after manager expects:

```php
$review = mt_booking_email_parts(array_merge($booking, ['status' => 'confirmed', 'id' => 1]), 'review', [
    'AUTH_URL' => 'https://escapeoccitanie.fr',
    'AUTH_SECRET' => 'test-secret',
]);
expect($review['subject'] === 'Un petit mot après votre partie — Escape Occitanie', 'review subject');
expect(str_contains($review['html'], '/api/avis.php?b=1'), 'review html has page link');
expect(!str_contains($review['html'], 'search.google.com/local/writereview'), 'review mail has no google review url');
expect(!str_contains($review['html'], 'facebook.com'), 'review mail has no facebook url');
expect(str_contains($review['text'], 'avis.php'), 'review text has page link');
```

These will fail until XML + `mt_booking_email_parts` handle `review`.

- [ ] **Step 2: Run compile test — expect FAIL** (`avis-google` / `client-avis` missing)

```bash
node apps/web/tools/test-compile-contribution.js
```

- [ ] **Step 3: Seed XML / MJML**

`contribution/contact.xml` — after `<instagram>…</instagram>`:

```xml
  <avis-google>https://search.google.com/local/writereview?cid=6874570004777222413</avis-google>
```

`contribution/emails.xml` — add:

```xml
  <mail id="client-avis">
    <sujet>Un petit mot après votre partie — Escape Occitanie</sujet>
    <mjml>emails/client-avis.mjml</mjml>
  </mail>
```

Create `contribution/emails/client-avis.mjml` (same chrome as `client-attente`, one button like `manager-nouvelle`):

```mjml
<mjml>
  <mj-head>
    <mj-preview>Un petit mot après votre partie.</mj-preview>
    <mj-attributes>
      <mj-all font-family="Georgia, serif" />
      <mj-text color="#e8dcc8" font-size="16px" line-height="1.55" padding="8px 24px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#1a1612">
    <mj-section background-color="#1a1612" padding="48px 20px">
      <mj-column background-color="#241f1a" border-radius="12px" padding="0">
        <mj-image src="{logo}" alt="{logo_alt}" width="88px" height="88px" border-radius="44px" align="center" padding="28px 20px 16px" />
        <mj-image src="{image_salle}" alt="{image_salle_alt}" width="560px" padding="0" fluid-on-mobile="true" />
        <mj-text font-size="22px" color="#f4ead6" padding="24px 24px 12px">Bonjour {nom},</mj-text>
        <mj-text padding="0 24px 12px">Merci d'avoir joué à {salle} le {date}. Si l'expérience vous a plu, un avis nous aide beaucoup — et n'hésitez pas à transmettre ce lien aux autres joueurs de votre équipe.</mj-text>
        <mj-button href="{lien_avis}" background-color="#c9a227" color="#1a1612" font-weight="700" inner-padding="12px 22px" padding="8px 24px 32px">
          Laisser un avis
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

- [ ] **Step 4: Compile parseContact + EMAIL_IDS + fixture** (as Step 1 described)

- [ ] **Step 5: mail.php**

In `mt_booking_copy_vars`, add:

```php
'lien_avis' => ($env !== [] && ($booking['id'] ?? 0) ? mt_review_page_url($env, $booking) : ''),
'lien_avis_google' => (string) ($copy['contact']['reviewGoogle'] ?? ''),
'lien_facebook' => (string) ($copy['contact']['facebook'] ?? ''),
'lien_instagram' => (string) ($copy['contact']['instagram'] ?? ''),
```

`mt_booking_email_parts` — map kind:

```php
$id = 'client-attente';
if ($kind === 'confirmed') {
    $id = 'client-confirmee';
} elseif ($kind === 'review') {
    $id = 'client-avis';
}
```

Fallback when template missing and `$kind === 'review'`: subject `Un petit mot après votre partie — Escape Occitanie`, text from:

```php
function mt_review_customer_email(array $booking, array $env = []): string {
    $name = (string) ($booking['guest_name'] ?? '');
    $room = mt_room_label((string) ($booking['room_slug'] ?? ''));
    $date = (string) ($booking['booking_date'] ?? '');
    $link = $env !== [] ? mt_review_page_url($env, $booking) : '';
    return "Bonjour {$name},\n\n"
        . "Merci d'avoir joué à {$room} le {$date}. Si l'expérience vous a plu, un avis nous aide beaucoup. Transmettez ce lien aux autres joueurs de votre équipe :\n"
        . "{$link}\n\n"
        . "À très bientôt,\n"
        . "L'équipe Escape Occitanie\n";
}
```

Replace the Task 3 stub:

```php
function mt_send_review_email(array $env, array $booking): bool {
    $parts = mt_booking_email_parts($booking, 'review', $env);
    return mt_send_mail(
        $env,
        (string) ($booking['guest_email'] ?? ''),
        $parts['subject'],
        $parts['text'],
        null,
        $parts['html'] !== '' ? $parts['html'] : null
    );
}
```

- [ ] **Step 6: Compile + tests**

```bash
node apps/web/tools/compile-contribution.js
node apps/web/tools/test-compile-contribution.js
php apps/web/tools/test-mail-copy.php
```

Expected: all `OK`. `site-copy.json` contains `client-avis` and `contact.reviewGoogle`.

- [ ] **Step 7: Commit**

Skip unless the user asked to commit.

---

### Task 5: Page publique `avis.php`

**Files:**

- Modify: `apps/web/public/api/lib/mail.php` — `mt_review_page_html`
- Create: `apps/web/public/api/avis.php`
- Modify: `apps/web/tools/test-mail-copy.php` — HTML contains Google / Facebook / Instagram + share/copy

**Interfaces:**

- Consumes: `mt_get_booking`, `mt_review_token_ok`, `mt_room_label`, `mt_load_site_copy`
- Produces: `mt_review_page_html(array $booking, string $state): string` — `$state` = `'ok'` \| `'invalid'`
- `GET /api/avis.php?b=&t=` — 200 ok if confirmed + token ; 400/404 invalid otherwise. Openable after `sent` / `skipped`.

- [ ] **Step 1: Failing test for HTML helper**

In `test-mail-copy.php`:

```php
$htmlOk = mt_review_page_html([
    'id' => 1,
    'guest_name' => 'Ada',
    'room_slug' => 'directeur',
    'booking_date' => '2026-09-01',
    'status' => 'confirmed',
], 'ok');
expect(str_contains($htmlOk, 'Ada') || str_contains($htmlOk, 'Directeur') || str_contains($htmlOk, '2026-09-01'), 'review page has booking');
expect(str_contains($htmlOk, 'Google'), 'review page Google');
expect(str_contains($htmlOk, 'Facebook'), 'review page Facebook');
expect(str_contains($htmlOk, 'Instagram'), 'review page Instagram');
expect(str_contains($htmlOk, 'autres joueurs'), 'review page asks to share');
expect(str_contains($htmlOk, 'navigator.share') || str_contains($htmlOk, 'clipboard'), 'review page share or copy');
$htmlBad = mt_review_page_html([], 'invalid');
expect(str_contains($htmlBad, 'invalide') || str_contains($htmlBad, 'valable'), 'invalid copy');
```

- [ ] **Step 2: Run — expect FAIL**

```bash
php apps/web/tools/test-mail-copy.php
```

- [ ] **Step 3: `mt_review_page_html`**

Same visual language as `mt_manager_confirm_page_html` (`.box`, gold `#c9a227`, dark `#1a1612` / `#241f1a`). For `ok`:

- Title: Merci
- Lead: `Merci d'avoir joué à {salle} le {date}.`
- Three `<a class="btn">` : Google (`contact.reviewGoogle`), Facebook, Instagram. Labels **Google**, **Facebook**, **Instagram**.
- Share block: « Envoyez cette page aux autres joueurs de votre équipe. » Buttons **Partager** (`id="share"`) and **Copier le lien** (`id="copy"`).
- Inline script:

```javascript
(function () {
  var url = location.href;
  var share = document.getElementById('share');
  var copy = document.getElementById('copy');
  if (share) {
    if (!navigator.share) share.hidden = true;
    share.addEventListener('click', function () {
      navigator.share({ title: document.title, url: url, text: 'Un petit mot après votre partie — Escape Occitanie' });
    });
  }
  if (copy) {
    copy.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
      }
    });
  }
})();
```

`invalid`: title « Lien invalide », lead « Ce lien n’est plus valable. » No social buttons.

Use `mt_html()` on all interpolated strings.

- [ ] **Step 4: `apps/web/public/api/avis.php`**

Mirror `confirm-booking.php` (GET only, no POST):

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function mt_avis_page_out(int $status, string $html): void {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo $html;
    exit;
}

$env = mt_boot();
$id = (int) ($_GET['b'] ?? $_GET['id'] ?? 0);
$token = trim((string) ($_GET['t'] ?? ''));
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || $id < 1 || $token === '') {
    mt_avis_page_out(400, mt_review_page_html([], 'invalid'));
}

try {
    $pdo = mt_pdo($env);
    $booking = mt_get_booking($pdo, $id, $env);
} catch (Throwable $e) {
    mt_avis_page_out(500, mt_review_page_html([], 'invalid'));
}

if (
    !$booking
    || ($booking['status'] ?? '') !== 'confirmed'
    || !mt_review_token_ok($env, $id, (string) $booking['guest_email'], $token)
) {
    mt_avis_page_out(404, mt_review_page_html($booking ?: [], 'invalid'));
}

mt_avis_page_out(200, mt_review_page_html($booking, 'ok'));
```

Do **not** reject `sent` / `skipped`.

- [ ] **Step 5: Run tests**

```bash
php apps/web/tools/test-mail-copy.php
php apps/web/tools/test-api-lib.php
```

Expected: `OK`

- [ ] **Step 6: Commit**

Skip unless the user asked to commit.

---

### Task 6: Hash filtre + clients JS

**Files:**

- Modify: `apps/web/src/lib/reservationsHash.js`
- Modify: `apps/web/tools/test-reservations-hash.js`
- Modify: `apps/web/src/lib/booking.js`

**Interfaces:**

- Consumes: existing `parseJson`
- Produces:
  - `BOOKING_FILTERS` includes `{ id: 'avis', label: 'Avis' }` (after À confirmer, before Toutes)
  - `parseBookingFilter('avis') === 'avis'`
  - `requestBookingReview(id)` → `POST /api/bookings.php?id=${id}&action=review-ask`
  - `skipBookingReview(id)` → `POST …&action=review-skip`

- [ ] **Step 1: Failing hash test**

In `test-reservations-hash.js`, change the filter-ids expect to:

```javascript
expect(BOOKING_FILTERS.map((item) => item.id).join(',') === 'aujourdhui,a-confirmer,avis,toutes', 'filter ids');
expect(parseBookingFilter('avis') === 'avis', 'avis filter');
expect(parseLocationHash('#reservations?filtre=avis&page=1').filtre === 'avis', 'avis from hash');
```

Keep `TAB_ALIASES.avis === 'records'` — add a guard so it still maps the **tab**:

```javascript
expect(parseLocationHash('#avis').tab === 'records', 'hash #avis stays records tab');
```

- [ ] **Step 2: Run — expect FAIL**

```bash
node apps/web/tools/test-reservations-hash.js
```

- [ ] **Step 3: Implement hash**

`BOOKING_FILTERS`:

```javascript
export const BOOKING_FILTERS = [
  { id: 'aujourdhui', label: 'Aujourd’hui' },
  { id: 'a-confirmer', label: 'À confirmer' },
  { id: 'avis', label: 'Avis' },
  { id: 'toutes', label: 'Toutes' },
];
```

In `parseBookingFilter`, **before** the `toutes` check (or after, but before the default `aujourdhui`):

```javascript
if (value === 'avis' || value === 'reviews') return 'avis';
```

Do not change `TAB_ALIASES`.

- [ ] **Step 4: Clients in `booking.js`**

Next to `resendBookingEmail`:

```javascript
export async function requestBookingReview(id) {
  const res = await fetch(`/api/bookings.php?id=${id}&action=review-ask`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseJson(res);
}

export async function skipBookingReview(id) {
  const res = await fetch(`/api/bookings.php?id=${id}&action=review-skip`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseJson(res);
}
```

- [ ] **Step 5: Run hash test**

```bash
node apps/web/tools/test-reservations-hash.js
```

Expected: `OK`

- [ ] **Step 6: Commit**

Skip unless the user asked to commit.

---

### Task 7: Maître Thibault — boutons et filtre

**Files:**

- Modify: `apps/web/src/pages/MaitreThibaultPage.jsx`

**Interfaces:**

- Consumes: `BOOKING_FILTERS`, `requestBookingReview`, `skipBookingReview`, flags `past_actions` / `can_ask_review` / `review_url` / `review_ask` / `status`
- Produces: UI per spec table. No clock on the client.

- [ ] **Step 1: Imports + handlers**

Add `requestBookingReview`, `skipBookingReview` to the `booking.js` import.

Handlers next to `onResendMail`:

```javascript
async function onRequestReview(id) {
  try {
    const result = await requestBookingReview(id);
    toast.success(result.emailSent ? 'Lien d’avis envoyé.' : 'E-mail non envoyé (vérifie SMTP).');
    await reloadBookings();
  } catch (err) {
    toastFromApi(err);
  }
}

async function onSkipReview(id) {
  try {
    await skipBookingReview(id);
    toast.success('Avis non demandé.');
    await reloadBookings();
  } catch (err) {
    toastFromApi(err);
  }
}

async function onCopyReviewLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Lien copié.');
  } catch {
    toast.error('Impossible de copier le lien.');
  }
}
```

Use the existing `reloadBookings()` (same as `onConfirmBooking`).

`emptyBookingsLabel`: add `if (filtre === 'avis') return 'Aucun avis à demander.';`

- [ ] **Step 2: Replace the action buttons cell**

Current block (~line 1138): cancelled → null; else Confirmer / Annuler / Modifier / Renvoyer.

Replace the inner `div.flex` with:

```jsx
{row.status === 'cancelled' ? null : (
  <div className="flex flex-wrap justify-end gap-2">
    {row.status === 'pending' ? (
      <Button type="button" size="sm" onClick={() => onConfirmBooking(row.id)}>
        Confirmer
      </Button>
    ) : null}
    {!row.past_actions ? (
      <>
        <Button type="button" variant="destructive" size="sm" onClick={() => setCancellingBooking(row)}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (editingBooking === row.id ? setEditingBooking(null) : startEditBooking(row))}
        >
          Modifier
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onResendMail(row.id)}>
          Renvoyer l’e-mail
        </Button>
      </>
    ) : null}
    {row.can_ask_review ? (
      <>
        <Button type="button" size="sm" onClick={() => onRequestReview(row.id)}>
          Demander un avis
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onSkipReview(row.id)}>
          Ne pas demander d’avis
        </Button>
      </>
    ) : null}
    {row.past_actions && row.status === 'confirmed' && row.review_ask !== 'skipped' && row.review_url ? (
      <Button type="button" variant="outline" size="sm" onClick={() => onCopyReviewLink(row.review_url)}>
        Copier le lien
      </Button>
    ) : null}
  </div>
)}
```

`BOOKING_FILTERS.map` already renders all filters — no extra UI once Task 6 added `avis`.

Do not show a status label for sent/skipped.

- [ ] **Step 3: Lint the page**

```bash
npx eslint apps/web/src/pages/MaitreThibaultPage.jsx apps/web/src/lib/booking.js apps/web/src/lib/reservationsHash.js --config apps/web/eslint.config.mjs --quiet
```

Expected: exit 0

- [ ] **Step 4: Commit**

Skip unless the user asked to commit.

---

### Task 8: Vérification navigateur

**Files:** none new.

- [ ] **Step 1: Dev server**

```bash
npm run dev --prefix apps/web
```

Log in at `/maitre-Thibault`.

- [ ] **Step 2: Filtre Avis**

Confirm button **Avis** next to À confirmer / Toutes. Empty copy: `Aucun avis à demander.` if none.

Seed (or use) a **confirmed** booking with `booking_date` yesterday. It appears in Avis with **Demander un avis**, **Copier le lien**, **Ne pas demander d’avis**. No Modifier / Renvoyer / Annuler.

A **today** confirmed booking still has Modifier / Renvoyer / Annuler, no review buttons.

A **pending** yesterday booking: **Confirmer** only.

- [ ] **Step 3: Copier + skip + ask**

- Copier le lien → toast, paste in a tab: page publique with 3 buttons + share/copy, no login.
- Ne pas demander → row leaves Avis, silent in Toutes (no label, no copy button).
- On another eligible row: Demander un avis → mail (check Hostinger / logs) with one CTA. After success, row leaves Avis; in Toutes, **Copier le lien** remains. Open the mail link.

- [ ] **Step 4: Page publique**

Token tamper → « Lien invalide ». Confirmed + sent still opens. Pending/cancelled → invalide.

Share (if browser supports) / Copier on the public page copies the same URL.

- [ ] **Step 5: Regression**

Aujourd’hui / À confirmer / Toutes, confirm, resend, edit, cancel on **today’s** bookings still work. Planning deep-link to a booking still works.

---

## Self-review (spec coverage)

| Spec | Task |
|---|---|
| Seuil calendaire `booking_date` Paris | 1 |
| Filtre Avis SQL | 2 |
| Flags API snake_case | 2 |
| POST ask/skip, mark after send, 400/409 | 3 |
| Mail un lien, MJML, `avis-google` | 4 |
| Page publique + partage autres joueurs | 5 |
| Hash `filtre=avis`, pas `#avis` tab | 6 |
| Boutons bureau + copier + masquage édition | 7 |
| Vérif navigateur | 8 |
| Hors scope WhatsApp / cron / labels | not implemented |
