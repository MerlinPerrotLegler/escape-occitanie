# Availability Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un tableau horizontal des créneaux des deux salles, réutilisable sur `/reservation` et sous « Votre mission commence ici », avec réservation inline.

**Architecture:** Fonctions pures dans `availabilityTimeline.js`. `AvailabilityTimeline` charge `fetchOpenPeriods` + `fetchDaySlots` (variantes strictes) pour 7 jours d’ouverture à la fois. Le formulaire est extrait de `BookingCalendar` en `BookingForm` / `BookingSuccess`. Pas de nouvel endpoint PHP. Textes dans `contribution/reserver.xml`.

**Tech Stack:** React 18, Vite, React Router 7, Tailwind, react-hook-form + zod (`bookingContactSchema`), APIs PHP existantes.

**Spec:** `docs/superpowers/specs/2026-09-01-availability-timeline-design.md`

## Global Constraints

- Ne pas committer sauf demande explicite de l’utilisateur.
- Fuseau Europe/Paris.
- Deux salles, ordre `ROOM_LIST`, libellé `shortName`.
- Pas de nouvel endpoint PHP. Ne pas modifier `dist/`.
- Routes `/reservation/:salle` et le calendrier mois restent.
- Footer et CTA accueil `/#salles` inchangés.
- Pas de deep-link `?date=` sur `/reservation`.
- Tous les textes UI nouveaux passent par `contribution/reserver.xml` (compile existant).
- `fetchDaySlots` / `fetchOpenPeriods` actuels (lenients) restent pour `BookingCalendar`.

## File map

Create:

- `apps/web/src/lib/availabilityTimeline.js` — helpers purs
- `apps/web/tools/test-availability-timeline.js` — tests Node
- `apps/web/src/components/BookingForm.jsx` — formulaire + écran succès
- `apps/web/src/components/AvailabilityTimeline.jsx` — tableau + pagination
- `apps/web/src/pages/ReservationPage.jsx` — page `/reservation`

Modify:

- `apps/web/src/lib/booking.js` — `fetchOpenPeriodsStrict` / `fetchDaySlotsStrict`
- `apps/web/src/components/BookingCalendar.jsx` — utilise `BookingForm` / `BookingSuccess`
- `contribution/reserver.xml` — `<page>` + `<timeline>`
- `apps/web/tools/compile-contribution.js` — parse ces nœuds
- `apps/web/tools/test-compile-contribution.js` — fixture + assertion
- `apps/web/src/App.jsx` — route exacte `/reservation`
- `apps/web/src/pages/RoomPage.jsx` — embed sous le h2
- `apps/web/src/components/SiteHeader.jsx` — CTA → `/reservation`

---

### Task 1: Helpers purs + tests

**Files:**

- Create: `apps/web/tools/test-availability-timeline.js`
- Create: `apps/web/src/lib/availabilityTimeline.js`

**Interfaces:**

- Consumes: `timeToMinutes` depuis `apps/web/src/lib/bookingDeepLink.js`
- Produces:
  - `PAGE_SIZE = 7`
  - `openDayIsos(periodDates: string[], todayISO: string): string[]`
  - `pageSlice(openIsos: string[], pageIndex: number, pageSize?: number): { days: string[], pageIndex: number, pageCount: number, hasPrev: boolean, hasNext: boolean }`
  - `isSlotBookable(slot, { iso, todayISO, nowMinutes }): boolean`
  - `buildColumns(days, slotsByRoomByDate, { todayISO, nowMinutes, roomSlugs }): { iso, time, cells: Record<string, 'open'|'unavailable'> }[]`
  - `groupColumnsByDay(columns): { iso: string, columns: typeof columns }[]`
  - `formatDayHeading(iso: string, todayISO: string): string`
  - `formatPageRange(days: string[]): string`
  - `parisToday(): Date`
  - `parisNowMinutes(): number`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tools/test-availability-timeline.js`:

```javascript
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

expect(PAGE_SIZE === 7, 'PAGE_SIZE is 7');

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
expect(p0.days.length === 7 && p0.pageCount === 1 && p0.hasPrev === false && p0.hasNext === false, 'exactly 7 → 1 page');

const eight = [...seven, '2026-09-09'];
const p0b = pageSlice(eight, 0);
const p1 = pageSlice(eight, 1);
expect(p0b.days.length === 7 && p0b.hasNext === true && p0b.hasPrev === false, '8 days page 0');
expect(p1.days.join(',') === '2026-09-09' && p1.pageCount === 2 && p1.hasPrev === true && p1.hasNext === false, '8 days last page has 1');
expect(pageSlice(eight, 99).pageIndex === 1, 'pageIndex clamped to last');

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
expect(cols.map((c) => `${c.iso} ${c.time}`).join('|') === '2026-09-02 14:00|2026-09-02 14:30|2026-09-02 15:00', 'union of times, skip empty day');
expect(cols[0].cells.directeur === 'open' && cols[0].cells.vaisseau === 'unavailable', 'A open B closed');
expect(cols[1].cells.directeur === 'unavailable' && cols[1].cells.vaisseau === 'unavailable', 'reserved / missing');
expect(cols[2].cells.directeur === 'unavailable' && cols[2].cells.vaisseau === 'open', 'missing / open');

const grouped = groupColumnsByDay(cols);
expect(grouped.length === 1 && grouped[0].iso === '2026-09-02' && grouped[0].columns.length === 3, 'one day group');

expect(formatDayHeading('2026-09-02', '2026-09-02').toLowerCase().includes('sept'), 'heading has month, no forced year');
expect(formatDayHeading('2027-01-01', '2026-09-02').includes('2027'), 'other year shows year');
expect(formatPageRange([] ) === '', 'empty range');
expect(formatPageRange(['2026-09-01']).includes('1'), 'single day');
expect(formatPageRange(['2026-09-01', '2026-09-07']).includes('1') && formatPageRange(['2026-09-01', '2026-09-07']).includes('7'), 'same-month span');

if (failed > 0) {
  process.stderr.write(`${failed} assertion(s) failed\n`);
  process.exit(1);
}
console.log('OK');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node apps/web/tools/test-availability-timeline.js
```

Expected: FAIL (MODULE_NOT_FOUND `availabilityTimeline.js`)

- [ ] **Step 3: Implement helpers**

Create `apps/web/src/lib/availabilityTimeline.js`:

```javascript
import { timeToMinutes } from './bookingDeepLink.js';

export const PAGE_SIZE = 7;

export function parisToday() {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function parisNowMinutes() {
  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  const [hour, minute] = stamp.split(':').map(Number);
  return hour * 60 + minute;
}

export function openDayIsos(periodDates, todayISO) {
  return [...new Set((periodDates || []).filter((iso) => iso && iso >= todayISO))].sort();
}

export function pageSlice(openIsos, pageIndex, pageSize = PAGE_SIZE) {
  const list = openIsos || [];
  if (list.length === 0) {
    return { days: [], pageIndex: 0, pageCount: 0, hasPrev: false, hasNext: false };
  }
  const pageCount = Math.ceil(list.length / pageSize);
  const p = Math.max(0, Math.min(Number(pageIndex) || 0, pageCount - 1));
  return {
    days: list.slice(p * pageSize, p * pageSize + pageSize),
    pageIndex: p,
    pageCount,
    hasPrev: p > 0,
    hasNext: p < pageCount - 1,
  };
}

export function isSlotBookable(slot, { iso, todayISO, nowMinutes }) {
  if (!slot || slot.status !== 'open') return false;
  if (!iso || iso < todayISO) return false;
  if (iso === todayISO && timeToMinutes(slot.time) < nowMinutes) return false;
  return true;
}

export function buildColumns(days, slotsByRoomByDate, { todayISO, nowMinutes, roomSlugs }) {
  const columns = [];
  for (const iso of days || []) {
    const times = new Set();
    for (const slug of roomSlugs) {
      for (const slot of slotsByRoomByDate?.[slug]?.[iso] || []) {
        if (slot?.time) times.add(slot.time);
      }
    }
    for (const time of [...times].sort()) {
      const cells = {};
      for (const slug of roomSlugs) {
        const slot = (slotsByRoomByDate?.[slug]?.[iso] || []).find((row) => row.time === time);
        cells[slug] = isSlotBookable(slot, { iso, todayISO, nowMinutes }) ? 'open' : 'unavailable';
      }
      columns.push({ iso, time, cells });
    }
  }
  return columns;
}

export function groupColumnsByDay(columns) {
  const groups = [];
  for (const col of columns || []) {
    const last = groups[groups.length - 1];
    if (last && last.iso === col.iso) last.columns.push(col);
    else groups.push({ iso: col.iso, columns: [col] });
  }
  return groups;
}

export function formatDayHeading(iso, todayISO) {
  const date = new Date(`${iso}T12:00:00`);
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (iso.slice(0, 4) !== String(todayISO).slice(0, 4)) opts.year = 'numeric';
  return new Intl.DateTimeFormat('fr-FR', opts).format(date);
}

export function formatPageRange(days) {
  if (!days?.length) return '';
  const first = new Date(`${days[0]}T12:00:00`);
  const last = new Date(`${days[days.length - 1]}T12:00:00`);
  const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  if (days[0] === days[days.length - 1]) return dayMonth.format(first);
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(first);
    return `${first.getDate()}–${last.getDate()} ${month}`;
  }
  return `${dayMonth.format(first)} – ${dayMonth.format(last)}`;
}
```

- [ ] **Step 4: Run tests and make sure they pass**

```bash
node apps/web/tools/test-availability-timeline.js
```

Expected: `OK`

If `formatDayHeading` / `formatPageRange` fail on month abbreviation, keep the assertions on day numbers / year only and re-run.

---

### Task 2: Copy XML + compile

**Files:**

- Modify: `contribution/reserver.xml`
- Modify: `apps/web/tools/compile-contribution.js` (`parseReserver`)
- Modify: `apps/web/tools/test-compile-contribution.js`

**Interfaces:**

- Consumes: `parseReserver` existant
- Produces: `COPY.reserver.page` et `COPY.reserver.timeline` (camelCase comme le calendrier)

- [ ] **Step 1: Extend the compile fixture and a compile assertion**

In `apps/web/tools/test-compile-contribution.js`, inside the `reserver.xml` template (after `</calendrier>`), add:

```xml
  <page>
    <seo titre="Réservation — Escape Occitanie" description="Comparez les deux salles et réservez 60 min."/>
    <seo-og description="Disponibilités des deux salles."/>
    <surtitre>Réservation</surtitre>
    <titre>Réservation</titre>
    <intro>Intro comparatif</intro>
  </page>
  <timeline>
    <reserver>Réserver</reserver>
    <non-dispo>Non dispo</non-dispo>
    <aria-reserver>Réserver {salle}, {date} à {heure}</aria-reserver>
    <form-titre>{date} à {heure} — {salle} — {occupancy} min</form-titre>
    <vide>Aucune date ouverte pour le moment.</vide>
    <erreur>Impossible de charger les disponibilités.</erreur>
    <reessayer>Réessayer</reessayer>
    <aucun-horaire>Aucun horaire sur ces dates.</aucun-horaire>
    <page-prev>Dates précédentes</page-prev>
    <page-next>Dates suivantes</page-next>
  </timeline>
```

After `expect(copy.accueil.experience.atouts.length === 4, '4 atouts');` add:

```javascript
  expect(copy.reserver.page.titre === 'Réservation', 'reserver page titre');
  expect(copy.reserver.timeline.nonDispo === 'Non dispo', 'timeline non dispo');
```

- [ ] **Step 2: Run compile tests to verify they fail**

```bash
node apps/web/tools/test-compile-contribution.js
```

Expected: FAIL (`<page>` / `<timeline>` inconnus, ou `copy.reserver.page` undefined)

- [ ] **Step 3: Parse `<page>` and `<timeline>`**

In `parseReserver` (`apps/web/tools/compile-contribution.js`), after building `calendrier`, also parse:

```javascript
  const page = reqNode(file, node, 'page');
  const pageSeo = reqNode(file, page, 'seo');
  const pageSeoOg = reqNode(file, page, 'seo-og');
  const timeline = reqNode(file, node, 'timeline');
```

Return extra keys:

```javascript
    page: {
      seo: {
        titre: str(pageSeo.titre) || reqStr(file, pageSeo, 'titre'),
        description: str(pageSeo.description) || reqStr(file, pageSeo, 'description'),
      },
      seoOg: {
        description: str(pageSeoOg.description) || reqStr(file, pageSeoOg, 'description'),
      },
      surtitre: reqStr(file, page, 'surtitre'),
      titre: reqStr(file, page, 'titre'),
      intro: reqStr(file, page, 'intro'),
    },
    timeline: {
      reserver: reqStr(file, timeline, 'reserver'),
      nonDispo: reqStr(file, timeline, 'non-dispo'),
      ariaReserver: reqStr(file, timeline, 'aria-reserver'),
      formTitre: reqStr(file, timeline, 'form-titre'),
      vide: reqStr(file, timeline, 'vide'),
      erreur: reqStr(file, timeline, 'erreur'),
      reessayer: reqStr(file, timeline, 'reessayer'),
      aucunHoraire: reqStr(file, timeline, 'aucun-horaire'),
      pagePrev: reqStr(file, timeline, 'page-prev'),
      pageNext: reqStr(file, timeline, 'page-next'),
    },
```

- [ ] **Step 4: Seed production XML**

Append to `contribution/reserver.xml` (after `</calendrier>`, before `</reserver>`):

```xml
  <page>
    <seo titre="Réservation — Escape Occitanie" description="Comparez les disponibilités des deux salles et réservez votre session d'escape game de 60 minutes chez Escape Occitanie."/>
    <seo-og description="Disponibilités et réservation pour les deux salles d'Escape Occitanie."/>
    <surtitre>Réservation</surtitre>
    <titre>Réservation</titre>
    <intro>Comparez les deux salles et réservez un créneau de 60 minutes. Votre demande est d’abord enregistrée, puis confirmée par l’équipe.</intro>
  </page>
  <timeline>
    <reserver>Réserver</reserver>
    <non-dispo>Non dispo</non-dispo>
    <aria-reserver>Réserver {salle}, {date} à {heure}</aria-reserver>
    <form-titre>{date} à {heure} — {salle} — {occupancy} min</form-titre>
    <vide>Aucune date ouverte pour le moment.</vide>
    <erreur>Impossible de charger les disponibilités.</erreur>
    <reessayer>Réessayer</reessayer>
    <aucun-horaire>Aucun horaire sur ces dates.</aucun-horaire>
    <page-prev>Dates précédentes</page-prev>
    <page-next>Dates suivantes</page-next>
  </timeline>
```

- [ ] **Step 5: Re-run compile tests**

```bash
node apps/web/tools/test-compile-contribution.js
```

Expected: `OK` (or the file’s existing success log). Confirm `npm run dev` still compiles `contribution/`.

---

### Task 3: Extraire `BookingForm` / `BookingSuccess`

**Files:**

- Create: `apps/web/src/components/BookingForm.jsx`
- Modify: `apps/web/src/components/BookingCalendar.jsx`

**Interfaces:**

- Consumes: `bookingContactSchema`, `createBooking`, `COPY.reserver.calendrier`, `CONTACT`, `fillCopy`
- Produces:
  - `BookingForm({ room, iso, time, settings, formRef, onSuccess })`
  - `BookingSuccess({ booking, room })`

`settings` = objet `DEFAULT_BOOKING_SETTINGS` (`occupancy_minutes`, `auto_confirm`).

- [ ] **Step 1: Create `BookingForm.jsx`**

Move the current form JSX and the `if (done)` success block out of `BookingCalendar.jsx` without changing copy, classes, or validation.

```jsx
import React, { useState } from 'react';
import { CalendarCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CONTACT } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';
import { fillCopy } from '@/lib/fillCopy';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { createBooking } from '@/lib/booking';
import { bookingContactSchema } from '@/lib/bookingContact';

const cal = COPY.reserver.calendrier;

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function BookingSuccess({ booking, room }) {
  const confirmed = booking.status === 'confirmed';
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-6 sm:p-8">
      <CalendarCheck className="h-8 w-8 text-primary" />
      <h2 className="mt-4 font-display text-2xl font-bold tracking-wide">
        {confirmed ? cal.doneConfirme : cal.doneDemande}
      </h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        {fillCopy(confirmed ? cal.doneCorpsConfirme : cal.doneCorpsDemande, {
          nom: booking.guest_name,
          salle: room.name,
          date: dayFormatter.format(new Date(`${booking.booking_date}T12:00:00`)),
          heure: booking.time,
          joueurs: booking.players,
          email: booking.guest_email,
        })}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {confirmed ? cal.doneArriveConfirme : cal.doneArriveAttente}
      </p>
    </div>
  );
}

export function BookingForm({ room, iso, time, settings, formRef, title, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const contactForm = useForm({
    resolver: zodResolver(bookingContactSchema),
    mode: 'onTouched',
    defaultValues: { name: '', email: '', phone: '', players: 4 },
  });
  const dateLabel = dayFormatter.format(new Date(`${iso}T12:00:00`));

  async function onSubmit(values) {
    setSubmitting(true);
    try {
      const result = await createBooking({
        room: room.slug,
        date: iso,
        time,
        name: values.name,
        email: values.email,
        phone: values.phone,
        players: Number(values.players),
      });
      const confirmed = result.booking?.status === 'confirmed' || settings.auto_confirm;
      toast.success(
        confirmed
          ? result.emailSent
            ? cal.toastConfirmeMail
            : cal.toastConfirme
          : result.emailSent
            ? cal.toastDemandeMail
            : cal.toastDemande
      );
      onSuccess?.(result.booking);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...contactForm}>
      <form
        ref={formRef}
        id="reservation"
        onSubmit={contactForm.handleSubmit(onSubmit)}
        className="mt-5 scroll-mt-24 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4"
        noValidate
      >
        <p className="flex items-center gap-2 font-display text-sm font-bold tracking-wider text-primary">
          <CalendarCheck className="h-4 w-4" />
          {title || `${dateLabel} à ${time} — ${settings.occupancy_minutes} min`}
        </p>
        <FormField
          control={contactForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={cal.placeholderNom} autoComplete="name" {...field} />
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
                <Input type="email" placeholder={cal.placeholderEmail} autoComplete="email" {...field} />
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
                <Input type="tel" placeholder={cal.placeholderTel} autoComplete="tel" {...field} />
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
                {cal.joueurs}
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
          {cal.bouton}
        </Button>
        <p className="text-xs text-muted-foreground">
          {fillCopy(settings.auto_confirm ? cal.noteAuto : cal.noteManuel, {
            telephone: CONTACT.phone,
          })}
        </p>
      </form>
    </Form>
  );
}
```

- [ ] **Step 2: Wire `BookingCalendar.jsx`**

Remove `contactForm`, `submitting`, `onSubmit`, the inline `<form>`, and the `if (done)` success JSX.

Keep `done` / `setDone` / `formSectionRef` / `selectSlot`.

Imports: add `BookingForm`, `BookingSuccess` from `@/components/BookingForm`. Drop unused `useForm`, `zodResolver`, `bookingContactSchema`, `createBooking`, `Form*`, `Input`, `Button`, `Users`, `CalendarCheck` if unused.

Top of render:

```jsx
  if (done) {
    return <BookingSuccess booking={done} room={room} />;
  }
```

Replace the form block with:

```jsx
            {selectedSlot && (
              <BookingForm
                room={room}
                iso={selectedISO}
                time={selectedSlot}
                settings={settings}
                formRef={formSectionRef}
                onSuccess={setDone}
              />
            )}
```

- [ ] **Step 3: Sanity-check the per-room booking page still renders**

With `npm run dev` already running, open `/reservation/convocation-chez-le-directeur`. Expected: calendrier mois + (après choix d’un créneau) le même formulaire qu’avant. Ne pas casser le scroll vers `#reservation`.

---

### Task 4: Fetchers stricts + `AvailabilityTimeline`

**Files:**

- Modify: `apps/web/src/lib/booking.js`
- Create: `apps/web/src/components/AvailabilityTimeline.jsx`

**Interfaces:**

- Consumes: helpers Task 1, `BookingForm` / `BookingSuccess`, `ROOM_LIST`, `COPY.reserver.timeline`, `horizonIso`, `toISODate`
- Produces: `AvailabilityTimeline({ highlightRoom?: string })`
- Produces: `fetchOpenPeriodsStrict(from, to)`, `fetchDaySlotsStrict(room, date)` — throw si HTTP/réseau KO. `200` + liste vide = succès.

- [ ] **Step 1: Add strict fetchers**

In `apps/web/src/lib/booking.js`, after the lenient functions:

```javascript
export async function fetchOpenPeriodsStrict(from, to) {
  const res = await fetch(`/api/periods.php?from=${from}&to=${to}`);
  if (!res.ok) throw new Error('Impossible de charger les disponibilités.');
  const data = await res.json().catch(() => ({}));
  if (!Array.isArray(data.periods)) throw new Error('Impossible de charger les disponibilités.');
  return data.periods;
}

export async function fetchDaySlotsStrict(room, date) {
  const res = await fetch(`/api/availability.php?room=${encodeURIComponent(room)}&date=${date}`);
  if (!res.ok) throw new Error('Impossible de charger les disponibilités.');
  const data = await res.json().catch(() => ({}));
  if (!Array.isArray(data.slots)) throw new Error('Impossible de charger les disponibilités.');
  return data.slots;
}
```

Do **not** change the lenient `fetchOpenPeriods` / `fetchDaySlots`.

- [ ] **Step 2: Implement `AvailabilityTimeline.jsx`**

Create `apps/web/src/components/AvailabilityTimeline.jsx` with this behavior (match classes to the site: `rounded-xl border border-border bg-card/60`, primary hover like the calendar):

1. `rooms = ROOM_LIST`, `roomSlugs = rooms.map(r => r.slug)`.
2. On mount: `today = parisToday()`, `todayISO = toISODate(today)`, `nowMinutes = parisNowMinutes()`, `fetchBookingSettings()`, `fetchOpenPeriodsStrict(todayISO, horizonIso(today))` → `openDayIsos(...)`.
3. `pageIndex` state (0). `slice = pageSlice(openIsos, pageIndex)`.
4. When `slice.days` changes: `Promise.all(days.flatMap(iso => roomSlugs.map(slug => fetchDaySlotsStrict(slug, iso).then(slots => [slug, iso, slots]))))`. Build `slotsByRoomByDate`. Any throw → `error` state.
5. Overlay `bookedKeys` (`Set` of `` `${slug}|${iso}|${time}` ``). When rendering a cell, if key in set → `unavailable`.
6. `columns = buildColumns(...)` then apply overlay. `groups = groupColumnsByDay(columns)`.
7. Changing `pageIndex` clears `selected` and `done` (not `bookedKeys`).
8. Click open cell: `setDone(null)`, `setSelected({ room, iso, time })`.
9. Under the table: if `done` → `BookingSuccess`; else if `selected` → `BookingForm` with `title={fillCopy(tl.formTitre, { date, heure, salle: room.name, occupancy: settings.occupancy_minutes })}` and `onSuccess` that adds the booked key + `setDone`.

Layout (CSS grid, sticky first column):

```jsx
<div className="overflow-hidden rounded-xl border border-border bg-card/60">
  <div className="flex items-center justify-between border-b border-border/70 px-3 py-3 sm:px-4">
    {/* prev / formatPageRange(slice.days) / next — ChevronLeft/Right like BookingCalendar */}
  </div>
  <div className="overflow-x-auto">
    <div
      className="grid min-w-max"
      style={{
        gridTemplateColumns: `8.5rem repeat(${columns.length}, 5.75rem)`,
        gridTemplateRows: `auto auto repeat(${rooms.length}, 3.25rem)`,
      }}
    >
      <div className="sticky left-0 z-10 bg-card" />
      {groups.map((group) => (
        <div
          key={group.iso}
          className="border-b border-border/60 px-1 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridColumn: `span ${group.columns.length}` }}
        >
          {formatDayHeading(group.iso, todayISO)}
        </div>
      ))}
      <div className="sticky left-0 z-10 bg-card" />
      {columns.map((col) => (
        <div key={`${col.iso}-${col.time}`} className="border-b border-border/60 text-center text-xs font-medium">
          {col.time}
        </div>
      ))}
      {rooms.map((room) => (
        <React.Fragment key={room.slug}>
          <div
            className={cn(
              'sticky left-0 z-10 flex items-center border-t border-border/50 bg-card px-3 text-sm font-semibold',
              highlightRoom === room.slug && 'bg-primary/10'
            )}
          >
            {room.shortName}
          </div>
          {columns.map((col) => {
            const status = bookedKeys.has(`${room.slug}|${col.iso}|${col.time}`)
              ? 'unavailable'
              : col.cells[room.slug];
            const active = selected?.room.slug === room.slug && selected.iso === col.iso && selected.time === col.time;
            return status === 'open' ? (
              <button
                key={`${room.slug}-${col.iso}-${col.time}`}
                type="button"
                onClick={() => { setDone(null); setSelected({ room, iso: col.iso, time: col.time }); }}
                aria-label={fillCopy(tl.ariaReserver, {
                  salle: room.shortName,
                  date: dayFormatter.format(new Date(`${col.iso}T12:00:00`)),
                  heure: col.time,
                })}
                className={cn(
                  'flex items-center justify-center border-t border-l border-border/40 text-xs font-medium',
                  'text-foreground hover:border-primary/60 hover:bg-primary/5',
                  active && 'border-primary bg-primary/15 text-primary'
                )}
              >
                {tl.reserver}
              </button>
            ) : (
              <div
                key={`${room.slug}-${col.iso}-${col.time}`}
                className="flex items-center justify-center border-t border-l border-border/40 text-[11px] text-muted-foreground/50"
              >
                {tl.nonDispo}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  </div>
</div>
```

States:

- Loading (periods or slots): two `Skeleton` rows (`h-12`) inside the same card.
- `openIsos.length === 0` after success: `{tl.vide}`
- Fetch error: `{tl.erreur}` + button `{tl.reessayer}` (re-run periods fetch, reset page 0)
- Loaded, `columns.length === 0`: `{tl.aucunHoraire}` but **keep pagination** if `hasPrev`/`hasNext`

`tl = COPY.reserver.timeline`. Use `ChevronLeft` / `ChevronRight`, disable prev when `!slice.hasPrev`, next when `!slice.hasNext`. `aria-label` = `tl.pagePrev` / `tl.pageNext`.

Full component must fetch settings once (`DEFAULT_BOOKING_SETTINGS` until loaded). Abort in-flight slot loads with a `cancelled` flag.

- [ ] **Step 3: Re-run helper tests**

```bash
node apps/web/tools/test-availability-timeline.js
```

Expected: `OK`

---

### Task 5: Page `/reservation` + route + header

**Files:**

- Create: `apps/web/src/pages/ReservationPage.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/components/SiteHeader.jsx`

**Interfaces:**

- Consumes: `AvailabilityTimeline`, `COPY.reserver.page`
- Produces: route exacte `/reservation` dans `PublicLayout`, avant les routes `/reservation/:salle`

- [ ] **Step 1: Create `ReservationPage.jsx`**

Mirror `BookingPage` chrome (`max-w-6xl`, `pt-28`, `Reveal`, Helmet + Seo) but **no** room sidebar. Copy from `COPY.reserver.page` (not `book.seo` with `{nom}`).

```jsx
import React from 'react';
import { Helmet } from 'react-helmet';
import Reveal from '@/components/Reveal';
import Seo from '@/components/Seo';
import AvailabilityTimeline from '@/components/AvailabilityTimeline';
import { CONTACT } from '@/data/rooms';
import { COPY } from '@/generated/siteCopy';

function ReservationPage() {
  const page = COPY.reserver.page;
  return (
    <>
      <Helmet>
        <title>{page.seo.titre}</title>
        <meta name="description" content={page.seo.description} />
      </Helmet>
      <Seo
        title={page.seo.titre}
        description={page.seoOg.description}
        siteName={CONTACT.name}
      />
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <Reveal>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            {page.surtitre}
          </p>
          <h1 className="mt-3 font-display text-3xl font-black tracking-wide sm:text-4xl">
            {page.titre}
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            {page.intro}
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-10">
          <AvailabilityTimeline />
        </Reveal>
      </section>
    </>
  );
}

export default ReservationPage;
```

- [ ] **Step 2: Register the route**

In `apps/web/src/App.jsx`, import `ReservationPage` and add **inside** `PublicLayout`, **before** the two `/reservation/...` routes:

```jsx
          <Route path="/reservation" element={<ReservationPage />} />
```

- [ ] **Step 3: Point header CTAs to `/reservation`**

In `apps/web/src/components/SiteHeader.jsx`, change both `to="/#salles"` on the Réserver buttons (desktop ~line 52 and mobile ~line 90) to `to="/reservation"`. Do **not** change `navItems` Contact `/#contact`. Leave `SiteFooter` and `HomePage` `/#salles` alone.

- [ ] **Step 4: Manual route check**

Open `/reservation` — page titre + tableau (ou état vide/erreur). Open `/reservation/convocation-chez-le-directeur` — calendrier mois inchangé.

---

### Task 6: Embed page salle

**Files:**

- Modify: `apps/web/src/pages/RoomPage.jsx`

**Interfaces:**

- Consumes: `AvailabilityTimeline({ highlightRoom })`
- Produces: tableau pleine largeur sous le h2 histoire, grid 3/2 inchangé en dessous

- [ ] **Step 1: Restructure the Histoire section**

Import `AvailabilityTimeline`. Current structure is one `grid lg:grid-cols-5` wrapping titre + story + aside. Split to:

```jsx
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            {labels.histoireSurtitre}
          </p>
          <h2 className="mt-4 font-display text-2xl font-bold tracking-wide sm:text-3xl">
            {labels.histoireTitre}
          </h2>
        </Reveal>
        <Reveal delay={0.05} className="mt-8">
          <AvailabilityTimeline highlightRoom={room.slug} />
        </Reveal>
        <div className="mt-12 grid gap-12 lg:grid-cols-5 lg:gap-16">
          <Reveal className="lg:col-span-3">
            <div>
              <div className="space-y-5 leading-relaxed text-muted-foreground">
                {room.story.map(/* unchanged */)}
              </div>
              {/* quote box unchanged */}
            </div>
          </Reveal>
          <Reveal delay={0.15} className="lg:col-span-2">
            {/* aside unchanged — still links to room.bookingPath */}
          </Reveal>
        </div>
      </section>
```

Hero « Réserver cette salle » and aside « Voir les disponibilités » stay on `room.bookingPath`.

- [ ] **Step 2: Check both room routes**

`/salles/convocation-chez-le-directeur` and `/salles/la-malediction-du-vaisseau-fantome`: tableau under the h2, matching row highlighted, story + infos still present.

---

### Task 7: Vérification navigateur

**Files:** none (verification only)

- [ ] **Step 1: Re-run unit tests**

```bash
node apps/web/tools/test-availability-timeline.js
node apps/web/tools/test-compile-contribution.js
```

Expected: both OK.

- [ ] **Step 2: Exercise the UI** (`npm run dev` on port 3000)

Using the browser tools:

1. Header desktop **Réserver** → `/reservation`. Sticky salle column, horizontal scroll, two rows, grouped day headers.
2. Pagination if more than 7 open days; last page may be shorter. Prev disabled on first page.
3. Click **Réserver** → form under the table (not a modal), title includes salle + date + heure. Click another slot → form retargets, no confirm dialog.
4. Page salle: timeline under « Votre mission commence ici », `highlightRoom` visible, hero still goes to calendrier salle.
5. `/reservation/convocation-chez-le-directeur` still month calendar.
6. Footer / homepage `/#salles` unchanged.
7. Mobile viewport (~390px): sticky column + scroll still usable.
8. If no open days: empty copy. If you simulate API down (stop PHP): error + Réessayer.

Do **not** claim done without this pass. Fix layout/alignment issues (row height vs sticky labels, header row span) before finishing.

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| Helpers PAGE_SIZE / openDayIsos / pageSlice / isSlotBookable / buildColumns | 1 |
| Copy `/reservation` + timeline strings | 2 |
| BookingForm partagé, validation existante | 3 |
| Fetch APIs existantes, erreur si un fetch slots échoue | 4 |
| Sticky + scroll, 7 jours, form inline, overlay booked | 4 |
| Route `/reservation`, header CTA | 5 |
| Room page sous le h2, highlightRoom | 6 |
| Per-room calendar unchanged, footer /#salles unchanged | 5–7 |
| Browser verification | 7 |
