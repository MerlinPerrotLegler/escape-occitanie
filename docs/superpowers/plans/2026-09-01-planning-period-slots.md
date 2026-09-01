# Planning period slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les créneaux sous la plage ouverte dans Planning, paginer par mois (mois en lettres + année), et reproduire horaires + états vers d’autres jours.

**Architecture:** Helpers JS purs pour le mois. `mt_copy_period` en PHP (tout-ou-rien, 409 si conflits). UI : `MonthYearSelect`, `PeriodSlots` en accordion, `PeriodCopyDialog`. Le bloc Créneaux du bas disparaît ; **Ajouter une plage** reste un formulaire séparé, non lié au mois Planning.

**Tech Stack:** React 18, shadcn Dialog, PHP 8, MySQL `opening_periods` + `closed_slots`.

**Spec:** `docs/superpowers/specs/2026-09-01-planning-period-slots-design.md`

## Global Constraints

- Ne pas committer sauf demande explicite de l’utilisateur (les steps « Commit » sont optionnels).
- PHP tests : `/Applications/MAMP/bin/php/php8.4.1/bin/php`.
- JS tests : `node apps/web/tools/test-….js` (même style `expect` que `test-short-date.js`).
- Copy FR : accordion une plage à la fois ; Reproduire copie horaires + Indisponible/Fermé des deux salles, jamais les résas ; Occupé sur la cible reste occupé.
- Confirmation unique : « Écraser les N jours déjà ouverts ? »
- Titres exacts : **Ajouter une plage** puis **Planning**.
- Mois : locale `fr-FR`, capitale initiale (`Septembre`). Années : même horizon que `yearSelectOptions`, affichées en 4 chiffres.
- `GET /api/periods.php?from=&to=` existe déjà (public, intervalle inclusif y compris passé) — ne pas exiger de session sur ce chemin (le calendrier public l’utilise). Planning appelle avec `credentials: 'include'`.
- `POST /api/periods.php?action=copy` **avant** le parse date/start/end du POST create.
- Hors scope : AvailabilityTimeline public, copier des résas, plusieurs plages conservées sur un jour cible après overwrite.
- Ne pas éditer `dist/`.

## File map

Create:

- `apps/web/src/lib/monthYear.js`
- `apps/web/tools/test-month-year.js`
- `apps/web/src/components/MonthYearSelect.jsx`
- `apps/web/tools/test-period-copy.php`
- `apps/web/src/components/PeriodSlots.jsx`
- `apps/web/src/components/PeriodCopyDialog.jsx`

Modify:

- `apps/web/public/api/lib/booking.php` — `mt_get_period`, `mt_copy_period`
- `apps/web/public/api/periods.php` — `action=copy`
- `apps/web/src/lib/booking.js` — `fetchPeriods(from, to)`, `copyPeriod`
- `apps/web/src/pages/MaitreThibaultPage.jsx` — deux sections, accordion, plus de bloc Créneaux du bas

---

### Task 1: Helpers mois + `MonthYearSelect`

**Files:**

- Create: `apps/web/src/lib/monthYear.js`
- Create: `apps/web/tools/test-month-year.js`
- Create: `apps/web/src/components/MonthYearSelect.jsx`

**Interfaces:**

- Consumes: `yearSelectOptions`, `fullYear`, `pad2`, `parisTodayIso` from `apps/web/src/lib/shortDate.js`
- Produces:
  - `MONTH_LABELS_FR` — `['Janvier', …, 'Décembre']`
  - `isoToYearMonth(iso: string): string | null` — `'2027-09'`
  - `monthBounds(yearMonth: string): { from: string, to: string } | null`
  - `filterPeriodsInMonth(periods: Array<{period_date: string}>, yearMonth: string): same array`
  - `buildMonthCells(year: number, month1to12: number): Array<Date|null>` — lundi en première colonne
  - `monthYearSelectYears(todayIso: string, selectedYearMonth: string): string[]` — années `'2026'`…

- [ ] **Step 1: Write the failing test**

Create `apps/web/tools/test-month-year.js`:

```javascript
import {
  MONTH_LABELS_FR,
  isoToYearMonth,
  monthBounds,
  filterPeriodsInMonth,
  buildMonthCells,
  monthYearSelectYears,
} from '../src/lib/monthYear.js';

let failed = 0;
function expect(cond, msg) {
  if (!cond) {
    process.stderr.write(`FAIL: ${msg}\n`);
    failed += 1;
  }
}

expect(MONTH_LABELS_FR[8] === 'Septembre', 'September label');
expect(isoToYearMonth('2027-09-03') === '2027-09', 'ISO to YYYY-MM');
expect(JSON.stringify(monthBounds('2027-09')) === JSON.stringify({ from: '2027-09-01', to: '2027-09-30' }), 'September bounds');
expect(JSON.stringify(monthBounds('2028-02')) === JSON.stringify({ from: '2028-02-01', to: '2028-02-29' }), 'leap February');

const rows = [
  { id: 1, period_date: '2027-08-31' },
  { id: 2, period_date: '2027-09-01' },
  { id: 3, period_date: '2027-09-30' },
  { id: 4, period_date: '2027-10-01' },
];
expect(filterPeriodsInMonth(rows, '2027-09').map((r) => r.id).join(',') === '2,3', 'filter September');

const cells = buildMonthCells(2027, 9);
expect(cells[0] === null || cells[0].getDay() === 1, 'grid starts Monday (pad or Monday)');
expect(cells.filter(Boolean).length === 30, 'September has 30 day cells');
const firstDay = cells.find(Boolean);
expect(firstDay.getDate() === 1 && firstDay.getMonth() === 8, 'first real cell is 1 Sep');

const years = monthYearSelectYears('2026-09-01', '2027-09');
expect(years.includes('2025') && years.includes('2026') && years.includes('2027'), 'year horizon includes prev, current, selected');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node apps/web/tools/test-month-year.js
```

Expected: `ERR_MODULE_NOT_FOUND` for `monthYear.js`.

- [ ] **Step 3: Write minimal implementation**

`apps/web/src/lib/monthYear.js`:

```javascript
import { fullYear, pad2, yearSelectOptions } from './shortDate.js';

export const MONTH_LABELS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function isoToYearMonth(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return iso.slice(0, 7);
}

export function monthBounds(yearMonth) {
  const match = String(yearMonth || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(last)}`,
  };
}

export function filterPeriodsInMonth(periods, yearMonth) {
  const bounds = monthBounds(yearMonth);
  if (!bounds) return [];
  return (periods || []).filter((row) => row.period_date >= bounds.from && row.period_date <= bounds.to);
}

export function buildMonthCells(year, month1to12) {
  const first = new Date(year, month1to12 - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month1to12 - 1, day));
  return cells;
}

export function monthYearSelectYears(todayIso, selectedYearMonth) {
  const selectedIso = /^\d{4}-\d{2}$/.test(selectedYearMonth || '')
    ? `${selectedYearMonth}-01`
    : todayIso;
  return yearSelectOptions(todayIso, selectedIso).map((yy) => String(fullYear(yy)));
}
```

`apps/web/src/components/MonthYearSelect.jsx`:

```jsx
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parisTodayIso } from '@/lib/shortDate';
import { MONTH_LABELS_FR, isoToYearMonth, monthYearSelectYears } from '@/lib/monthYear';

const SELECT_CLASS =
  'h-11 appearance-none border-0 bg-transparent px-2 text-base outline-none focus:bg-primary/10 md:h-9 md:text-sm';

function MonthYearSelect({ value, onChange, id, className }) {
  const todayIso = parisTodayIso();
  const yearMonth = /^\d{4}-\d{2}$/.test(value || '') ? value : isoToYearMonth(todayIso);
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const years = monthYearSelectYears(todayIso, yearMonth);
  const prefix = id || 'month-year';

  function update(nextYear, nextMonth) {
    const y = String(nextYear);
    const m = String(nextMonth).padStart(2, '0');
    onChange(`${y}-${m}`);
  }

  return (
    <div
      id={`${prefix}-group`}
      role="group"
      className={cn(
        'inline-flex overflow-hidden rounded-md border border-input bg-transparent shadow-sm focus-within:ring-1 focus-within:ring-ring',
        className
      )}
    >
      <label className="sr-only" htmlFor={`${prefix}-month`}>Mois</label>
      <div className="relative">
        <select
          id={`${prefix}-month`}
          className={cn(SELECT_CLASS, 'w-[9.5rem] pr-7')}
          value={month}
          onChange={(e) => update(year, Number(e.target.value))}
        >
          {MONTH_LABELS_FR.map((label, index) => (
            <option key={label} value={index + 1}>{label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
      <label className="sr-only" htmlFor={`${prefix}-year`}>Année</label>
      <div className="relative border-l border-input">
        <select
          id={`${prefix}-year`}
          className={cn(SELECT_CLASS, 'w-[4.5rem] pr-7')}
          value={year}
          onChange={(e) => update(Number(e.target.value), month)}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

export default MonthYearSelect;
```

Fix the test’s first-cell assertion if September 2027 does not start on Monday: `buildMonthCells` pads with `null`, so `cells[0] === null || cells[0].getDay() === 1` is correct. Keep `filter(Boolean).length === 30`.

- [ ] **Step 4: Run test to verify it passes**

```bash
node apps/web/tools/test-month-year.js
```

Expected: `OK`

- [ ] **Step 5: Commit** (only if the user asked)

```bash
git add apps/web/src/lib/monthYear.js apps/web/tools/test-month-year.js apps/web/src/components/MonthYearSelect.jsx
git commit -m "Add month/year helpers and MonthYearSelect."
```

---

### Task 2: `mt_copy_period` PHP

**Files:**

- Modify: `apps/web/public/api/lib/booking.php`
- Create: `apps/web/tools/test-period-copy.php`

**Interfaces:**

- Consumes: `mt_add_period`, `mt_delete_period`, `mt_slot_flags_for`, `mt_set_slot_kind`, `mt_fetch_active_bookings`, `mt_periods_for_date`, `MT_ROOM_SLUGS`, `mt_unit_status` / occupancy overlap
- Produces:
  - `mt_get_period(PDO $pdo, int $id): ?array` — même forme que `mt_period_payload`
  - `mt_copy_period(PDO $pdo, int $sourceId, array $dates, bool $overwrite): array`
    - success: `['ok' => true, 'copied' => int]`
    - not found: `['ok' => false, 'error' => 'not_found']`
    - bad input: `['ok' => false, 'error' => 'invalid']`
    - conflict: `['ok' => false, 'dates' => list<string>]` (ISO triées, uniques)

- [ ] **Step 1: Write the failing test**

Create `apps/web/tools/test-period-copy.php` (même bootstrap que `test-slot-duration.php`) :

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

function cleanup_days(PDO $pdo, array $dates): void {
    foreach ($dates as $date) {
        $pdo->prepare('DELETE FROM bookings WHERE booking_date = ?')->execute([$date]);
        $pdo->prepare('DELETE FROM opening_periods WHERE period_date = ?')->execute([$date]);
        if (function_exists('mt_table_exists') && mt_table_exists($pdo, 'closed_slots')) {
            $pdo->prepare('DELETE FROM closed_slots WHERE slot_date = ?')->execute([$date]);
        }
    }
}

$env = mt_boot();
$pdo = mt_pdo($env);
mt_ensure_schema($pdo);

$src = '2099-07-10';
$empty = '2099-07-11';
$busy = '2099-07-12';
cleanup_days($pdo, [$src, $empty, $busy]);

try {
    $source = mt_add_period($pdo, $src, 600, 840); // 10:00–14:00
    mt_set_slot_kind($pdo, 'directeur', $src, 660, 'hidden'); // 11:00
    mt_set_slot_kind($pdo, 'vaisseau', $src, 720, 'closed'); // 12:00

    $missing = mt_copy_period($pdo, 0, [$empty], false);
    expect(($missing['ok'] ?? true) === false && ($missing['error'] ?? '') === 'not_found', 'missing source');

    $copied = mt_copy_period($pdo, (int) $source['id'], [$empty], false);
    expect(($copied['ok'] ?? false) === true && (int) $copied['copied'] === 1, 'copy to empty day');
    $periods = mt_periods_for_date($pdo, $empty);
    expect(count($periods) === 1 && (int) $periods[0]['start_minute'] === 600 && (int) $periods[0]['end_minute'] === 840, 'hours copied');
    expect((mt_slot_flags_for($pdo, 'directeur', $empty)[660] ?? '') === 'hidden', 'directeur hidden copied');
    expect((mt_slot_flags_for($pdo, 'vaisseau', $empty)[720] ?? '') === 'closed', 'vaisseau closed copied');

    mt_add_period($pdo, $busy, 600, 1320);
    $conflict = mt_copy_period($pdo, (int) $source['id'], [$busy], false);
    expect(($conflict['ok'] ?? true) === false && in_array($busy, $conflict['dates'] ?? [], true), '409-style conflict');
    expect(count(mt_periods_for_date($pdo, $busy)) === 1 && (int) mt_periods_for_date($pdo, $busy)[0]['end_minute'] === 1320, 'no write on conflict');

    $booking = mt_create_booking($pdo, [
        'room_slug' => 'directeur',
        'booking_date' => $busy,
        'start_minute' => 660,
        'guest_name' => 'Keep Me',
        'guest_email' => 'keep@example.com',
        'guest_phone' => '0600000099',
        'players' => 4,
    ]);
    $over = mt_copy_period($pdo, (int) $source['id'], [$busy], true);
    expect(($over['ok'] ?? false) === true, 'overwrite succeeds');
    expect(count(mt_periods_for_date($pdo, $busy)) === 1 && (int) mt_periods_for_date($pdo, $busy)[0]['end_minute'] === 840, 'one copied period');
    $kept = mt_get_booking($pdo, (int) $booking['id']);
    expect($kept && $kept['status'] !== 'cancelled', 'booking kept');
    $dirFlags = mt_slot_flags_for($pdo, 'directeur', $busy);
    expect(!isset($dirFlags[660]), 'do not flag occupied unit');
    expect((mt_slot_flags_for($pdo, 'vaisseau', $busy)[720] ?? '') === 'closed', 'unoccupied flag still copied');
} finally {
    cleanup_days($pdo, [$src, $empty, $busy]);
}

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
```

- [ ] **Step 2: Run test to verify it fails**

```bash
/Applications/MAMP/bin/php/php8.4.1/bin/php apps/web/tools/test-period-copy.php
```

Expected: `Call to undefined function mt_copy_period()`.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/public/api/lib/booking.php`, after `mt_update_period`:

```php
function mt_get_period(PDO $pdo, int $id): ?array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT id, period_date, start_minute, end_minute FROM opening_periods WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    return mt_period_payload((int) $row['id'], (string) $row['period_date'], (int) $row['start_minute'], (int) $row['end_minute']);
}

function mt_dates_with_periods(PDO $pdo, array $dates): array {
    $dates = array_values(array_unique($dates));
    if ($dates === []) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($dates), '?'));
    $stmt = $pdo->prepare("SELECT DISTINCT period_date FROM opening_periods WHERE period_date IN ($placeholders)");
    $stmt->execute($dates);
    return array_map(static fn($row) => (string) $row['period_date'], $stmt->fetchAll());
}

function mt_delete_periods_on_date(PDO $pdo, string $date): void {
    $pdo->prepare('DELETE FROM opening_periods WHERE period_date = ?')->execute([$date]);
}

function mt_replace_closed_slots_from_source(PDO $pdo, string $sourceDate, string $targetDate): void {
    $pdo->prepare('DELETE FROM closed_slots WHERE slot_date = ?')->execute([$targetDate]);
    foreach (MT_ROOM_SLUGS as $room) {
        $flags = mt_slot_flags_for($pdo, $room, $sourceDate);
        $bookings = mt_fetch_active_bookings($pdo, $targetDate, $targetDate, $room);
        foreach ($flags as $minute => $kind) {
            if (mt_unit_status((int) $minute, $bookings, []) === 'reserved') {
                continue;
            }
            mt_set_slot_kind($pdo, $room, $targetDate, (int) $minute, $kind === 'hidden' ? 'hidden' : 'closed');
        }
    }
}

function mt_copy_period(PDO $pdo, int $sourceId, array $dates, bool $overwrite): array {
    mt_ensure_schema($pdo);
    $source = mt_get_period($pdo, $sourceId);
    if (!$source) {
        return ['ok' => false, 'error' => 'not_found'];
    }
    $clean = [];
    foreach ($dates as $date) {
        $date = is_string($date) ? trim($date) : '';
        if (!mt_is_iso_date($date) || $date === $source['period_date']) {
            continue;
        }
        $clean[$date] = $date;
    }
    $clean = array_values($clean);
    sort($clean);
    if ($clean === []) {
        return ['ok' => false, 'error' => 'invalid'];
    }
    $conflicts = mt_dates_with_periods($pdo, $clean);
    sort($conflicts);
    if ($conflicts !== [] && !$overwrite) {
        return ['ok' => false, 'dates' => $conflicts];
    }
    $pdo->beginTransaction();
    try {
        foreach ($clean as $date) {
            mt_delete_periods_on_date($pdo, $date);
            mt_add_period($pdo, $date, (int) $source['start_minute'], (int) $source['end_minute']);
            mt_replace_closed_slots_from_source($pdo, $source['period_date'], $date);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return ['ok' => true, 'copied' => count($clean)];
}
```

Note: `mt_set_slot_kind` vérifie que la minute est dans une plage — appeler **après** `mt_add_period`. Les flags source dont la minute n’existe pas dans la nouvelle plage (ne devrait pas arriver, mêmes horaires) lèveront ; ne pas copier ces minutes.

- [ ] **Step 4: Run test to verify it passes**

```bash
/Applications/MAMP/bin/php/php8.4.1/bin/php apps/web/tools/test-period-copy.php
```

Expected: `OK`

Also:

```bash
/Applications/MAMP/bin/php/php8.4.1/bin/php apps/web/tools/test-slot-duration.php
```

Expected: `OK`

- [ ] **Step 5: Commit** (only if asked)

```bash
git add apps/web/public/api/lib/booking.php apps/web/tools/test-period-copy.php
git commit -m "Add mt_copy_period to duplicate hours and slot flags."
```

---

### Task 3: HTTP `action=copy` + client JS

**Files:**

- Modify: `apps/web/public/api/periods.php`
- Modify: `apps/web/src/lib/booking.js`

**Interfaces:**

- Consumes: `mt_copy_period`
- Produces:
  - `POST /api/periods.php?action=copy` body `{ sourceId, dates, overwrite }`
  - 400 invalid, 404 not_found, 409 `{ error, dates }`, 200 `{ ok: true, copied }`
  - `copyPeriod(sourceId, dates, overwrite = false)`
  - `fetchPeriods(from?, to?)` — si `from` et `to`, query string

- [ ] **Step 1: Write the failing HTTP assertions in `test-period-copy.php`**

Do not spin a server. After PHP helpers are green, add:

```php
expect(function_exists('mt_copy_period'), 'helper exists for HTTP layer');
```

(HTTP mapping is thin; cover it by implementing next, then a one-shot php snippet **or** rely on browser in Task 5. Prefer a small block at the bottom of `test-period-copy.php` that only tests the helper return shapes already covered.)

No extra failing test required if Task 2 already locks return shapes. Implement HTTP to those shapes.

- [ ] **Step 2: Skip isolated HTTP fail** — mapping is mechanical; go implement.

- [ ] **Step 3: Implement**

In `periods.php`, **replace** the `POST` block with:

```php
if ($method === 'POST') {
    mt_require_session($env);
    $action = (string) ($_GET['action'] ?? '');
    if ($action === 'copy') {
        $body = mt_read_json();
        $sourceId = (int) ($body['sourceId'] ?? 0);
        $dates = $body['dates'] ?? null;
        $overwrite = (bool) ($body['overwrite'] ?? false);
        if ($sourceId < 1 || !is_array($dates)) {
            mt_json_out(400, ['error' => 'Source et dates obligatoires.']);
        }
        $result = mt_copy_period($pdo, $sourceId, $dates, $overwrite);
        if (($result['error'] ?? '') === 'not_found') {
            mt_json_out(404, ['error' => 'Plage introuvable.']);
        }
        if (($result['error'] ?? '') === 'invalid') {
            mt_json_out(400, ['error' => 'Dates invalides.']);
        }
        if (isset($result['dates'])) {
            mt_json_out(409, [
                'error' => 'Certains jours ont déjà une plage.',
                'dates' => $result['dates'],
            ]);
        }
        mt_json_out(200, ['ok' => true, 'copied' => (int) $result['copied']]);
    }
    $input = mt_require_period_input(mt_read_json());
    try {
        mt_json_out(200, mt_add_period($pdo, $input['date'], $input['start'], $input['end']));
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Enregistrement impossible, réessaie.']);
    }
}
```

In `apps/web/src/lib/booking.js`:

```javascript
export async function fetchPeriods(from, to) {
  const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';
  const res = await fetch(`/api/periods.php${qs}`, { credentials: 'include' });
  return parseJson(res);
}

export async function copyPeriod(sourceId, dates, overwrite = false) {
  const res = await fetch('/api/periods.php?action=copy', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, dates, overwrite }),
  });
  return parseJson(res);
}
```

Keep existing `createPeriod` / `updatePeriod` / `deletePeriod`. `parseJson` attache déjà `err.status` — le 409 arrivera avec `err.status === 409`. Étendre `parseJson` pour copier `data.dates` sur l’erreur :

```javascript
    err.status = res.status;
    err.warning = Boolean(data.warning);
    if (Array.isArray(data.dates)) err.dates = data.dates;
```

- [ ] **Step 4: Re-run PHP tests**

```bash
/Applications/MAMP/bin/php/php8.4.1/bin/php apps/web/tools/test-period-copy.php
```

Expected: `OK`

- [ ] **Step 5: Commit** (only if asked)

---

### Task 4: Accordion Planning + `PeriodSlots`

**Files:**

- Create: `apps/web/src/components/PeriodSlots.jsx`
- Modify: `apps/web/src/pages/MaitreThibaultPage.jsx`

**Interfaces:**

- Consumes: `PeriodSlots`, `MonthYearSelect`, `monthBounds`, `isoToYearMonth`, `fetchPeriods(from,to)`, `fetchAdminDaySlots`, `nextAdminSlotStatus`, `slotStatusLabel`
- Produces: page with **Ajouter une plage** (formulaire inchangé, `periodForm` **non** lié au mois Planning) and **Planning** (mois + liste accordion)

- [ ] **Step 1: Extract `PeriodSlots` (no new unit test — same buttons)**

`apps/web/src/components/PeriodSlots.jsx` — props `{ rooms, loading, emptyLabel, onToggle, onReservedClick }` where `rooms` is `[{ slug, label, slots }]`.

Copy the existing grid markup from `MaitreThibaultPage.jsx` (couleurs Occupé / Indisponible / Fermé / Ouvert, `slotStatusLabel`, clic réservé → `onReservedClick(booking_id)`).

```jsx
import React from 'react';
import { cn } from '@/lib/utils';
import { slotStatusLabel } from '@/lib/slotStatus';

function PeriodSlots({ rooms, loading, emptyLabel, onToggle, onReservedClick }) {
  if (loading) {
    return <p className="mt-4 text-sm text-muted-foreground">Chargement des créneaux…</p>;
  }
  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      {rooms.map((room) => {
        const slots = room.slots || [];
        return (
          <div key={room.slug} className="rounded-xl border border-border p-5">
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.15em]">{room.label}</h3>
            {slots.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => {
                  const isReserved = slot.status === 'reserved';
                  const isClosed = slot.status === 'closed';
                  const isHidden = slot.status === 'hidden';
                  const reservedLabel = slot.guest_name || slotStatusLabel(slot.status);
                  return (
                    <button
                      key={`${room.slug}-${slot.time}`}
                      type="button"
                      onClick={() => {
                        if (isReserved) {
                          if (slot.booking_id) onReservedClick(slot.booking_id);
                          return;
                        }
                        onToggle(room.slug, slot);
                      }}
                      className={cn(
                        'flex h-11 flex-col items-center justify-center rounded-md border px-1 text-xs font-medium transition-all duration-150',
                        isReserved
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                          : isHidden
                            ? 'border-sky-500/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                            : isClosed
                              ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
                              : 'border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/5'
                      )}
                      aria-label={
                        isReserved
                          ? `${slot.time} — ${reservedLabel}`
                          : `${slot.time} — ${slotStatusLabel(slot.status)}`
                      }
                    >
                      <span className="font-mono">{slot.time}</span>
                      <span
                        className={cn(
                          'max-w-full truncate text-[10px] leading-none',
                          isReserved
                            ? 'text-emerald-100'
                            : isHidden
                              ? 'text-sky-100'
                              : isClosed
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                        )}
                      >
                        {isReserved ? reservedLabel : slotStatusLabel(slot.status)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PeriodSlots;
```

- [ ] **Step 2: No isolated fail step** — extraction. Wire the page next.

- [ ] **Step 3: Rewrite Planning in `MaitreThibaultPage.jsx`**

State to add/replace:

```javascript
const [planningMonth, setPlanningMonth] = useState(() => isoToYearMonth(parisTodayIso()) || '');
const [expandedPeriodId, setExpandedPeriodId] = useState(null);
const expandedBlockRef = useRef(null);
```

Remove `slotDate` and `setPlanningDate` **as the shared date**. Keep `periodForm.date` for the create form only.

- `ShortDateInput` / `DayPagination` du formulaire : `onChange` met à jour uniquement `periodForm.date` (et `start`/`end` inchangés).
- `fetchPeriods` au `session` : ne plus charger toute la liste future. `useEffect` sur `[session, planningMonth]` :

```javascript
const bounds = monthBounds(planningMonth);
fetchPeriods(bounds.from, bounds.to).then((data) => {
  const list = sortPeriods(data.periods || []);
  setPeriods(list);
  setExpandedPeriodId((id) => (list.some((row) => row.id === id) ? id : null));
});
```

- `useEffect` `[session, tab, expandedPeriodId, periods]` : si une plage est ouverte, `fetchAdminDaySlots(row.period_date)` ; sinon `setDaySlots({ directeur: [], vaisseau: [] })`.

Accordion :

```javascript
function togglePeriod(row) {
  setExpandedPeriodId((id) => (id === row.id ? null : row.id));
}

useEffect(() => {
  if (!expandedPeriodId || !expandedBlockRef.current) return;
  expandedBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, [expandedPeriodId]);
```

Liste : **pas** de `max-h-64`. Ligne = bouton date/horaires `togglePeriod` ; **Modifier** / **Retirer** `stopPropagation` via boutons séparés (pas dans le bouton titre). **Reproduire** uniquement si `expandedPeriodId === row.id` (stub `onClick` vide jusqu’à Task 5, ou `setCopyingPeriod(row)`).

`ref={expandedPeriodId === row.id ? expandedBlockRef : null}` sur le `<li>` qui wrappe ligne + `PeriodSlots`.

Après create/update : `setPlanningMonth(isoToYearMonth(saved.period_date))`, `setExpandedPeriodId(saved.id)`, recharger le mois.

Titres : `h2` **Ajouter une plage** puis `h2` **Planning** + `MonthYearSelect` `value={planningMonth}` `onChange={setPlanningMonth}`.

Supprimer tout le bloc `<h2>Créneaux</h2>` (date, DayPagination slots, grilles).

Copy du formulaire : raccourcir le paragraphe d’intro — plus de « Clique une plage ci-dessus pour afficher ses créneaux ». Sous Planning : une ligne du type « Clique une plage pour voir ses créneaux. »

Empty : `Aucune plage ouverte ce mois-ci.`

- [ ] **Step 4: Manual / existing tests**

```bash
node apps/web/tools/test-month-year.js
/Applications/MAMP/bin/php/php8.4.1/bin/php apps/web/tools/test-slot-duration.php
```

Expected: `OK` both.

Browser (dev `http://127.0.0.1:3000/maitre#planning`) : ouvrir une plage → grilles dessous + scroll ; clic ailleurs referme ; formulaire Ajouter une plage crée toujours ; changer le mois filtre la liste.

- [ ] **Step 5: Commit** (only if asked)

---

### Task 5: `PeriodCopyDialog` + Reproduire

**Files:**

- Create: `apps/web/src/components/PeriodCopyDialog.jsx`
- Modify: `apps/web/src/pages/MaitreThibaultPage.jsx`
- Modify: `apps/web/src/lib/booking.js` (already has `copyPeriod`)

**Interfaces:**

- Consumes: `copyPeriod`, `fetchPeriods`, `MonthYearSelect`, `buildMonthCells`, `monthBounds`, `isoToYearMonth`
- Produces: dialog `open`, `source` period, `onCopied()`

- [ ] **Step 1: No new pure-function test required** — calendar cells already tested. Implement the dialog.

- [ ] **Step 2: n/a**

- [ ] **Step 3: Implement dialog**

`PeriodCopyDialog.jsx` props: `{ open, onOpenChange, source, onCopied }`.

State: `viewMonth` (init `isoToYearMonth(source.period_date)` when open), `selected` `Set` of ISO, `openDates` `Set` loaded via `fetchPeriods(bounds.from, bounds.to)` when `viewMonth` changes, `confirming` bool, `busy` bool.

Grid: `WEEKDAY_LABELS = ['Lun',…]`, `buildMonthCells(year, month)`.

Cell button:

- `iso === source.period_date` → disabled
- `openDates.has(iso)` → classe distincte (ex. `border-primary/50 bg-primary/10`)
- `selected.has(iso)` → `bg-primary text-primary-foreground`
- click toggle (sauf source)

Footer: `Copier` disabled si `selected.size === 0` ou `busy`.

Submit:

```javascript
try {
  await copyPeriod(source.id, [...selected], confirming);
  toast.success('Plages reproduites.');
  onCopied();
  onOpenChange(false);
} catch (err) {
  if (err.status === 409 && !confirming) {
    setConfirming(true);
    return;
  }
  toast.error(err.message);
}
```

Si `confirming` : afficher le texte `Écraser les ${err.dates?.length || 'N'} jours déjà ouverts ?` — store `conflictCount` from `err.dates.length` on 409. Boutons **Annuler** (`setConfirming(false)`) et **Écraser** (resubmit overwrite true).

Reset `selected` / `confirming` when `open` becomes false.

Page : `const [copySource, setCopySource] = useState(null);`  
Reproduire : `onClick={() => setCopySource(row)}`.  
`<PeriodCopyDialog open={Boolean(copySource)} source={copySource} onOpenChange={(v) => { if (!v) setCopySource(null); }} onCopied={() => { /* reload month via existing fetch */ }} />`

Use shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`.

- [ ] **Step 4: Verify**

```bash
node apps/web/tools/test-month-year.js
/Applications/MAMP/bin/php/php8.4.1/bin/php apps/web/tools/test-period-copy.php
```

Browser `http://127.0.0.1:3000/maitre#planning` :

1. Ouvrir une plage → grilles dessous + scroll.
2. Reproduire vers 2 jours vides du mois → listes mises à jour.
3. Reproduire vers un jour déjà ouvert → message écraser → Annuler (rien) puis Écraser (une plage copie).
4. Créneau occupé sur la cible reste vert / nom.

- [ ] **Step 5: Commit** (only if asked)

---

## Spec coverage

| Spec | Task |
|---|---|
| Accordion sous la plage, un à la fois, scrollIntoView | 4 |
| Ajouter une plage inchangé, date ≠ mois Planning | 4 |
| Planning mois lettres + année | 1 + 4 |
| Reproduire calendrier multi, source disabled, already-open marked | 5 |
| Copy hours + flags, not bookings, occupied wins | 2 |
| 409 all-or-nothing, overwrite confirm | 2 + 3 + 5 |
| Components PeriodSlots, MonthYearSelect, PeriodCopyDialog | 1, 4, 5 |
| POST action=copy | 3 |
| GET from/to past dates | existing API + 4 `fetchPeriods` |
| Tests JS month + PHP copy | 1, 2 |
| Hors scope public timeline / copy bookings | not in plan |
