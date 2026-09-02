# Contribution XML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir tous les textes et images de la vitrine dans `contribution/` (XML + MJML), compilés au `dev`/`build`, sans changer le look du site public.

**Architecture:** Un compile Node lit `contribution/`, écrit `siteCopy.js` (React) et `site-copy.json` (PHP). Les routes des salles restent dans le compile (constante), pas dans l’XML. Les e-mails MJML deviennent HTML+texte ; PHP substitue `{nom}`, `{salle}`, etc.

**Tech Stack:** Node ESM, `fast-xml-parser`, `mjml`, `html-to-text`, Vite 7, React 18, PHP 8 `mail()`.

**Spec:** `docs/superpowers/specs/2026-09-01-contribution-xml-design.md`

## Global Constraints

- Ne pas committer sauf demande explicite de l’utilisateur.
- Le front public ne change pas : mêmes classes, mêmes sections, mêmes URLs Hostinger au seed.
- Pas de 3ᵉ salle, pas d’éditeur Maître Thibault, pas de SQL pour le copy.
- `pagePath` / `bookingPath` ne sont pas dans l’XML ; le compile les injecte depuis `ROOM_ROUTES`.
- Images : `images/…` → copie vers `/media/…` ; `http(s)://` inchangé ; `alt` obligatoire.
- Build KO si XML/MJML invalide ou image locale absente.
- PHP : filet = textes actuels de `mail.php` si JSON absent.
- Placeholders `{nom}`, `{salle}`, `{date}`, `{heure}`, `{duree}`, `{joueurs}`, `{adresse}`, `{email}`, `{telephone}`, `{lien_ics}`, `{lien_google}`, `{nom-court}`.
- Hors scope : textes `/maitre`, ICS, qui reçoit quel mail.

## File map

Create:

- `contribution/*.xml` + `contribution/emails/*.mjml`
- `apps/web/tools/compile-contribution.js` — parse, validate, write outputs
- `apps/web/tools/test-compile-contribution.js`
- `apps/web/plugins/vite-plugin-contribution.js`
- `apps/web/src/lib/fillCopy.js` — substitution `{clé}` côté React
- `apps/web/tools/test-fill-copy.js`
- `apps/web/src/generated/.gitkeep` (le `.js` est gitignoré)
- `apps/web/tools/test-mail-copy.php`

Modify:

- `.gitignore` — `apps/web/src/generated/siteCopy.js`, `apps/web/public/api/site-copy.json`, `apps/web/public/media/`
- `apps/web/package.json` — deps compile + script test
- `apps/web/vite.config.js` — plugin + `fs.allow` repo `contribution/`
- `apps/web/src/data/rooms.js` — seulement `REVIEWS` + `records` filet
- Pages / header / footer / `App.jsx` 404 / `BookingCalendar.jsx` / `bookingContact.js`
- `apps/web/public/api/lib/mail.php`
- `apps/web/tools/generate-llms.js`

Do not edit `dist/` or CSS global.

## Interfaces

`compileContribution(contributionDir, { jsPath, jsonPath, mediaDir })` → objet `siteCopy` (le même que le JSON).

`siteCopy` :

```js
{
  contact: { name, domain, website, logo, logoAlt, address, phone, phoneHref, email, facebook, instagram, maps },
  rooms: {
    directeur: Room,
    vaisseau: Room,
  },
  commun: { /* strings, see Task 3 */ },
  accueil: { /* see Task 3 */ },
  reserver: { /* see Task 3 */ },
  emails: {
    'client-attente': { sujet, html, texte },
    'client-confirmee': { sujet, html, texte },
    'manager-nouvelle': { sujet, html, texte },
  }
}
```

`Room` : `slug, name, shortName, tagline, pagePath, bookingPath, players, minAge, duration, difficulty, successRate, image, imageAlt, cardDescription, story[], note, gallery[{src,alt,caption}]` — **sans** `records`.

`ROOM_ROUTES` dans le compile :

```js
export const ROOM_ROUTES = {
  directeur: {
    pagePath: '/salles/convocation-chez-le-directeur',
    bookingPath: '/reservation/convocation-chez-le-directeur',
  },
  vaisseau: {
    pagePath: '/salles/la-malediction-du-vaisseau-fantome',
    bookingPath: '/reservation/la-malediction-du-vaisseau-fantome',
  },
};
```

`fillCopy(template, vars)` : remplace `{clé}` ; clé inconnue laissée telle quelle.

`mt_load_site_copy(): ?array` — JSON à côté de `mail.php` (`__DIR__/../site-copy.json`).

`mt_fill_copy(string $template, array $vars): string`

Generated JS :

```js
export const CONTACT = { ... }
export const ROOMS = { directeur, vaisseau }
export const ROOM_LIST = [ROOMS.directeur, ROOMS.vaisseau]
export const HERO_IMAGE = accueil.hero.image
export const COPY = { commun, accueil, reserver }
```

---

### Task 1: `fillCopy` + tests

**Files:**

- Create: `apps/web/src/lib/fillCopy.js`
- Create: `apps/web/tools/test-fill-copy.js`

**Interfaces:**

- Produces: `fillCopy(template: string, vars: Record<string, string|number>): string`

- [ ] **Step 1: Write failing tests**

```js
import { fillCopy } from '../src/lib/fillCopy.js';
let failed = 0;
function expect(cond, msg) {
  if (!cond) { process.stderr.write(`FAIL: ${msg}\n`); failed += 1; }
}
expect(fillCopy('Réserver « {nom-court} »', { 'nom-court': 'Le Directeur' }) === 'Réserver « Le Directeur »', 'hyphen key');
expect(fillCopy('Bonjour {nom}', { nom: 'Ada' }) === 'Bonjour Ada', 'simple');
expect(fillCopy('reste {inconnu}', {}) === 'reste {inconnu}', 'unknown kept');
if (failed) process.exit(1);
console.log('OK');
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

`node apps/web/tools/test-fill-copy.js`

- [ ] **Step 3: Implement `fillCopy`**

```js
export function fillCopy(template, vars = {}) {
  return String(template ?? '').replace(/\{([a-z0-9-]+)\}/gi, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}
```

- [ ] **Step 4: Run — expect `OK`**

---

### Task 2: Compile + tests (TDD), deps

**Files:**

- Create: `apps/web/tools/compile-contribution.js`
- Create: `apps/web/tools/test-compile-contribution.js`
- Create: `apps/web/tools/fixtures/contribution-ok/` (minimal XML + 1 local png + 1 mjml)
- Modify: `apps/web/package.json`

**Interfaces:**

- Produces: `compileContribution(contributionDir, out)` as above ; throws `Error` including file path.

- [ ] **Step 1: `npm install -D fast-xml-parser mjml html-to-text -w web`**

- [ ] **Step 2: Failing tests** — fixture OK compile ; `https://` image not copied ; `images/x.png` copied to media and src becomes `/media/x.png` ; missing file throws ; missing required tag throws ; unknown slug throws ; emails have sujet/html/texte with `{nom}` still present.

- [ ] **Step 3: Run tests — FAIL**

- [ ] **Step 4: Implement compile** (XMLParser, validate, MJML, html-to-text, write js+json+media)

- [ ] **Step 5: Run tests — PASS**

Minimal XML in fixture must use the **same tag names** as production seed (Task 3).

---

### Task 3: Seed `contribution/` (copy actuel)

**Files:** Create all production XML/MJML under `contribution/` with **exact** current strings from `rooms.js`, `HomePage.jsx`, `RoomPage.jsx`, `BookingPage.jsx`, `BookingCalendar.jsx`, `bookingContact.js`, `SiteHeader.jsx`, `SiteFooter.jsx`, `App.jsx` 404, `mail.php`.

Image `src` = URLs Hostinger actuelles. Logo = URL horizons actuelle.

`emails/*.mjml` : mêmes phrases que `mail.php`, variables `{…}`, style simple (fond sombre, or) **sans** changer le site web.

- [ ] **Step 1: Write XML/MJML seed**
- [ ] **Step 2: `node apps/web/tools/compile-contribution.js` against repo `contribution/` — must succeed**

---

### Task 4: Vite plugin + gitignore + rooms.js

**Files:**

- Create: `apps/web/plugins/vite-plugin-contribution.js`
- Modify: `apps/web/vite.config.js` — plugin always (dev+build), `fs.allow` `path.resolve(__dirname, '../..')`
- Modify: `.gitignore`
- Modify: `apps/web/src/data/rooms.js` — `REVIEWS` + merge `records` onto rooms for fallback only
- Modify: `apps/web/package.json` `"build"` to keep compile via plugin (`buildStart`)

Plugin: `buildStart` + `configureServer` watch `contribution/**` → compile → `server.ws.send({ type: 'full-reload' })`.

`rooms.js` :

```js
import { CONTACT as GENERATED_CONTACT, ROOMS as GENERATED_ROOMS, ROOM_LIST as GENERATED_LIST, HERO_IMAGE } from '@/generated/siteCopy';

export const CONTACT = GENERATED_CONTACT;
export const HERO_IMAGE;
export const REVIEWS = [ /* inchangé */ ];

const RECORD_FALLBACK = { directeur: [...], vaisseau: [...] };

export const ROOMS = {
  directeur: { ...GENERATED_ROOMS.directeur, records: RECORD_FALLBACK.directeur },
  vaisseau: { ...GENERATED_ROOMS.vaisseau, records: RECORD_FALLBACK.vaisseau },
};
export const ROOM_LIST = [ROOMS.directeur, ROOMS.vaisseau];
```

Maitre Thibault continue d’importer `ROOMS` d’ici (noms + records filet).

- [ ] **Step 1: gitignore + plugin + vite config**
- [ ] **Step 2: Compile once so `siteCopy.js` exists**
- [ ] **Step 3: Slim `rooms.js`**
- [ ] **Step 4: `node apps/web/tools/test-reservations-hash.js` still OK** (no break)

---

### Task 5: Pages public consomment `COPY`

**Files:** `HomePage.jsx`, `RoomPage.jsx`, `BookingPage.jsx`, `BookingCalendar.jsx`, `bookingContact.js`, `SiteHeader.jsx`, `SiteFooter.jsx`, `App.jsx`

Remplacer littéraux par `COPY` / `CONTACT` / room fields. Garder le JSX/CSS. Hero : `COPY.accueil.hero.titre` + span `accent` + ` !` en JSX.

`bookingContact.js` : `NAME_ERROR` etc. lus depuis un petit `getBookingErrors()` qui importe `COPY.reserver.erreurs` — **attention** : les tests `test-booking-contact.js` importent les constantes. Soit garder les strings par défaut identiques en constantes (seed = mêmes messages), soit faire lire `COPY` seulement dans le schéma. **Décision :** garder les constantes actuelles dans `bookingContact.js` (mêmes phrases que le XML) **et** les exposer aussi dans XML pour le calendrier placeholders/toasts. Les messages Zod restent les constantes (inchangé pour les tests existants). Les placeholders / toasts / labels calendrier viennent de `COPY.reserver`.

- [ ] **Step 1: Wire components**
- [ ] **Step 2: `node apps/web/tools/test-booking-contact.js` — PASS**

---

### Task 6: PHP mails HTML + tests

**Files:**

- Modify: `apps/web/public/api/lib/mail.php`
- Create: `apps/web/tools/test-mail-copy.php`
- Check: `bookings.php` still calls `mt_send_booking_emails` / `mt_send_mail`

`mt_send_mail` : si `$html` fourni → multipart/alternative ; + attachment → mixed wrapping alternative.

`mt_booking_customer_email` returns text (filet or filled template). New `mt_booking_email_parts($booking, $kind, $env): { subject, text, html }`.

- [ ] **Step 1: Failing PHP test** — with a temp JSON, `mt_fill_copy` + load templates
- [ ] **Step 2: Implement**
- [ ] **Step 3: PASS** — without JSON, filet bodies match today’s wording

---

### Task 7: `generate-llms.js` + vérif navigateur

**Files:** `apps/web/tools/generate-llms.js`

Lire `public/api/site-copy.json` : pages `/`, salles, réservations avec titres/descriptions SEO du JSON (+ `{nom}` rempli).

- [ ] **Step 1: Update generator**
- [ ] **Step 2: Manual** — `/`, une salle, réservation, 404, header/footer identiques visuellement
- [ ] **Step 3: Casser un XML → `npm run build` échoue**
- [ ] **Step 4: `/maitre` avis/planning/résas OK**

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| dossier contribution + arborescence | 3 |
| compile dev+build, watch | 4 |
| JS + JSON + media | 2 |
| images URL vs local | 2 |
| front inchangé / seed | 3, 5, 7 |
| rooms.js filet avis/records | 4 |
| hero titre+accent | 5 |
| emails.xml sujet+chemin MJML | 3, 6 |
| PHP filet | 6 |
| generate-llms | 7 |
| tests Node + PHP | 1, 2, 6 |
| Maître Thibault hors copy | 4 (ROOMS import), 7 |
