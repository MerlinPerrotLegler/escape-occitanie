# Turnstile réservation publique Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquer les créations de réservation publiques sans jeton Cloudflare Turnstile (widget managed, vérif serveur fail-closed).

**Architecture:** Le site key public sort de `GET /api/turnstile.php` (env PHP). `BookingForm` rend le widget officiel, envoie `turnstileToken` dans `POST /api/bookings.php`. `mt_turnstile_verify` appelle `siteverify` avant tout INSERT. Pas de `VITE_*`, pas de lib npm Turnstile.

**Tech Stack:** React 18, PHP 8, cURL, Cloudflare Turnstile v0.

**Spec:** `docs/superpowers/specs/2026-09-02-turnstile-booking-design.md`

## Global Constraints

- Ne pas committer sauf demande explicite de l’utilisateur.
- Pas de nouvelle dépendance npm. Script officiel `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`.
- Messages exacts : `Réservation temporairement indisponible.` (503 / GET sans clé) ; `Vérification anti-robot requise.` (jeton vide) ; `Vérification anti-robot échouée, réessaie.` (Cloudflare refuse).
- Fail-closed : secret manquant, cURL absent, timeout, HTTP ≠ 200, JSON illisible → 503, pas d’INSERT.
- `mt_turnstile_verify` **avant** validation invité et verrou créneau. Uniquement le POST de création (`bookings.php` sans `?id`).
- Widget : `theme: 'dark'`, `language: 'fr'`, `appearance: 'always'`. Type Managed = tableau Cloudflare, pas un paramètre client.
- Placement : entre le sélecteur de joueurs et le bouton « Réserver ce créneau ».
- Pas de XML `contribution/`. Ne pas éditer `dist/`.
- Hors scope : login `/maitre`, PATCH, confirm/mail, honeypot, `hostname` siteverify.

## File map

Create:

- `apps/web/public/api/lib/turnstile.php` — `mt_turnstile_verify` + POST siteverify + constantes messages
- `apps/web/public/api/turnstile.php` — GET site key
- `apps/web/src/components/TurnstileField.jsx` — script + widget + fetch site key

Modify:

- `apps/web/tools/test-api-lib.php` — assertions `mt_turnstile_verify` (callback `$post`, zéro réseau)
- `apps/web/public/api/lib/env.php` — `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` dans `getenv()`
- `apps/web/public/api/bootstrap.php` — require `lib/turnstile.php`
- `apps/web/public/api/bookings.php` — vérif Turnstile en tête du POST création
- `.env.example` et `apps/web/public/api/.env.example` — clés listées, valeurs vides
- `apps/web/src/lib/booking.js` — `createBooking` transmet `turnstileToken` (déjà dans le payload JSON)
- `apps/web/src/components/BookingForm.jsx` — widget, bouton, reset
- `README.md` — dummy keys local + widget prod
- `.env` local (non versionné) — dummy always-pass pour la vérif navigateur

Do not edit `dist/`.

---

### Task 1: `mt_turnstile_verify` + tests + env

**Files:**

- Create: `apps/web/public/api/lib/turnstile.php`
- Modify: `apps/web/tools/test-api-lib.php`
- Modify: `apps/web/public/api/lib/env.php`
- Modify: `.env.example`
- Modify: `apps/web/public/api/.env.example`

**Interfaces:**

- Consumes: cURL (défaut), `TURNSTILE_SECRET_KEY` dans `$env`
- Produces:
  - `MT_TURNSTILE_VERIFY_URL` = `https://challenges.cloudflare.com/turnstile/v0/siteverify`
  - `MT_TURNSTILE_UNAVAILABLE` / `MT_TURNSTILE_REQUIRED` / `MT_TURNSTILE_FAILED` (strings exactes du spec)
  - `mt_turnstile_siteverify_post(string $url, array $fields): array` — `{ ok: bool, status: int, body: string }`
  - `mt_turnstile_verify(array $env, string $token, string $ip, ?callable $post = null): array` — `{ ok: bool, status: int, error: string }`
  - `$post` : `function(string $url, array $fields): array{ok?: bool, status: int, body: string}`

- [ ] **Step 1: Write the failing tests**

In `apps/web/tools/test-api-lib.php`, add `require $root . '/turnstile.php';` after `require $root . '/auth.php';`.

Before `if ($failed > 0)`, append:

```php
$secretEnv = ['TURNSTILE_SECRET_KEY' => 'test-secret'];
$okPost = static function (string $url, array $fields): array {
    expect($url === MT_TURNSTILE_VERIFY_URL, 'siteverify url');
    expect(($fields['secret'] ?? '') === 'test-secret', 'siteverify secret');
    expect(($fields['response'] ?? '') === 'tok', 'siteverify token');
    expect(($fields['remoteip'] ?? '') === '203.0.113.9', 'siteverify ip');
    return ['ok' => true, 'status' => 200, 'body' => '{"success":true}'];
};

$emptySecret = mt_turnstile_verify([], 'tok', '203.0.113.9', $okPost);
expect($emptySecret['ok'] === false, 'missing secret not ok');
expect((int) $emptySecret['status'] === 503, 'missing secret 503');
expect($emptySecret['error'] === 'Réservation temporairement indisponible.', 'missing secret message');

$called = false;
$mustNotPost = static function () use (&$called): array {
    $called = true;
    return ['ok' => true, 'status' => 200, 'body' => '{"success":true}'];
};
$emptyToken = mt_turnstile_verify($secretEnv, '  ', '203.0.113.9', $mustNotPost);
expect($emptyToken['ok'] === false, 'empty token not ok');
expect((int) $emptyToken['status'] === 400, 'empty token 400');
expect($emptyToken['error'] === 'Vérification anti-robot requise.', 'empty token message');
expect($called === false, 'empty token skips siteverify');

$ok = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', $okPost);
expect($ok['ok'] === true, 'success true ok');
expect((int) $ok['status'] === 200, 'success true status 200');

$denied = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => true, 'status' => 200, 'body' => '{"success":false}'];
});
expect($denied['ok'] === false, 'success false not ok');
expect((int) $denied['status'] === 400, 'success false 400');
expect($denied['error'] === 'Vérification anti-robot échouée, réessaie.', 'success false message');

$timeout = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => false, 'status' => 0, 'body' => ''];
});
expect($timeout['ok'] === false, 'timeout not ok');
expect((int) $timeout['status'] === 503, 'timeout 503');
expect($timeout['error'] === 'Réservation temporairement indisponible.', 'timeout message');

$http500 = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => false, 'status' => 500, 'body' => '{"success":true}'];
});
expect((int) $http500['status'] === 503, 'http 500 is 503 even if body says success');

$badJson = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => true, 'status' => 200, 'body' => 'not-json'];
});
expect((int) $badJson['status'] === 503, 'invalid json 503');
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
php apps/web/tools/test-api-lib.php
```

Expected: FAIL with `Failed opening required .../turnstile.php` (or `Call to undefined function mt_turnstile_verify`).

- [ ] **Step 3: Implement `turnstile.php`**

Create `apps/web/public/api/lib/turnstile.php`:

```php
<?php
declare(strict_types=1);

const MT_TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MT_TURNSTILE_UNAVAILABLE = 'Réservation temporairement indisponible.';
const MT_TURNSTILE_REQUIRED = 'Vérification anti-robot requise.';
const MT_TURNSTILE_FAILED = 'Vérification anti-robot échouée, réessaie.';

function mt_turnstile_result(bool $ok, int $status, string $error = ''): array {
    return ['ok' => $ok, 'status' => $status, 'error' => $error];
}

function mt_turnstile_siteverify_post(string $url, array $fields): array {
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'status' => 0, 'body' => ''];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 8,
        CURLOPT_USERAGENT => 'EscapeOccitanie/1.0',
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [
        'ok' => $raw !== false && $status === 200,
        'status' => $status,
        'body' => is_string($raw) ? $raw : '',
    ];
}

function mt_turnstile_verify(array $env, string $token, string $ip, ?callable $post = null): array {
    $secret = trim((string) ($env['TURNSTILE_SECRET_KEY'] ?? ''));
    if ($secret === '' || ($post === null && !function_exists('curl_init'))) {
        return mt_turnstile_result(false, 503, MT_TURNSTILE_UNAVAILABLE);
    }
    $token = trim($token);
    if ($token === '') {
        return mt_turnstile_result(false, 400, MT_TURNSTILE_REQUIRED);
    }
    $postFn = $post ?? 'mt_turnstile_siteverify_post';
    try {
        $res = $postFn(MT_TURNSTILE_VERIFY_URL, [
            'secret' => $secret,
            'response' => $token,
            'remoteip' => $ip,
        ]);
    } catch (Throwable $e) {
        return mt_turnstile_result(false, 503, MT_TURNSTILE_UNAVAILABLE);
    }
    if (!is_array($res) || (int) ($res['status'] ?? 0) !== 200) {
        return mt_turnstile_result(false, 503, MT_TURNSTILE_UNAVAILABLE);
    }
    $data = json_decode((string) ($res['body'] ?? ''), true);
    if (!is_array($data)) {
        return mt_turnstile_result(false, 503, MT_TURNSTILE_UNAVAILABLE);
    }
    if (($data['success'] ?? false) !== true) {
        return mt_turnstile_result(false, 400, MT_TURNSTILE_FAILED);
    }
    return mt_turnstile_result(true, 200, '');
}
```

- [ ] **Step 4: Add env names (empty examples + getenv)**

In `apps/web/public/api/lib/env.php`, add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to the `getenv()` foreach list (same array as `AUTH_SECRET` / `HOSTINGER_MAIL_MAILBOX_ID`).

In `.env.example`, after `HOSTINGER_MAIL_MAILBOX_ID=""`, add:

```
# Cloudflare Turnstile (réservation publique). Local : clés dummy du README.
TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""
```

In `apps/web/public/api/.env.example`, append:

```
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

- [ ] **Step 5: Run tests and make sure they pass**

```bash
php apps/web/tools/test-api-lib.php
```

Expected: `OK`

- [ ] **Step 6: Commit**

Skip unless the user explicitly asks.

---

### Task 2: GET site key + POST bookings

**Files:**

- Create: `apps/web/public/api/turnstile.php`
- Modify: `apps/web/public/api/bootstrap.php`
- Modify: `apps/web/public/api/bookings.php`

**Interfaces:**

- Consumes: `mt_boot()`, `mt_json_out()`, `mt_read_json()`, `mt_client_ip()`, `mt_turnstile_verify()`, `MT_TURNSTILE_UNAVAILABLE`
- Produces:
  - `GET /api/turnstile.php` → 200 `{ siteKey }` ou 503 `{ error }`
  - POST création `bookings.php` refuse sans jeton valide

- [ ] **Step 1: Require turnstile in bootstrap**

In `apps/web/public/api/bootstrap.php`, after `require_once __DIR__ . '/lib/http.php';` add:

```php
require_once __DIR__ . '/lib/turnstile.php';
```

- [ ] **Step 2: Create `turnstile.php` endpoint**

Create `apps/web/public/api/turnstile.php`:

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$env = mt_boot();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

$siteKey = trim((string) ($env['TURNSTILE_SITE_KEY'] ?? ''));
if ($siteKey === '') {
    mt_json_out(503, ['error' => MT_TURNSTILE_UNAVAILABLE]);
}
mt_json_out(200, ['siteKey' => $siteKey]);
```

- [ ] **Step 3: Verify Turnstile on public booking POST**

In `apps/web/public/api/bookings.php`, inside `if ($method === 'POST') {` immediately after `$body = mt_read_json();` and **before** `$room = ...`:

```php
    $checked = mt_turnstile_verify($env, (string) ($body['turnstileToken'] ?? ''), mt_client_ip());
    if (!$checked['ok']) {
        mt_json_out($checked['status'], ['error' => $checked['error']]);
    }
```

Do not add this to the earlier POST branch (`?id` + `action=mail|confirm`) nor to PATCH.

- [ ] **Step 4: Smoke GET endpoint**

If nothing listens on 8080, from `apps/web`: `npm run php:serve` (leave it running). Then:

```bash
curl -sS -D - http://127.0.0.1:8080/api/turnstile.php -o /tmp/turnstile-body.json
cat /tmp/turnstile-body.json
```

Expected without `TURNSTILE_SITE_KEY` in the env PHP loads: HTTP 503 and `{"error":"Réservation temporairement indisponible."}`.

If the root `.env` already has a site key (Task 4 dummy), expected: HTTP 200 and `{"siteKey":"..."}`. Either result is fine as long as the JSON matches the env and **never** contains `TURNSTILE_SECRET_KEY`.

- [ ] **Step 5: Commit**

Skip unless the user explicitly asks.

---

### Task 3: Widget React + `createBooking`

**Files:**

- Create: `apps/web/src/components/TurnstileField.jsx`
- Modify: `apps/web/src/components/BookingForm.jsx`
- Modify: `apps/web/src/lib/booking.js` (only if `createBooking` stops spreading extra keys — today `JSON.stringify(payload)` already forwards `turnstileToken`)

**Interfaces:**

- Consumes: `GET /api/turnstile.php`, `window.turnstile`, `createBooking(payload)`
- Produces:
  - `TurnstileField({ resetKey: string, onToken: (token: string) => void, onUnavailable: (unavailable: boolean) => void })`
  - `createBooking` body includes `turnstileToken`

- [ ] **Step 1: Create `TurnstileField.jsx`**

Create `apps/web/src/components/TurnstileField.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const UNAVAILABLE = 'Réservation temporairement indisponible.';

let scriptPromise = null;

function loadTurnstileScript() {
  if (typeof window !== 'undefined' && window.turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile-script')), { once: true });
      if (window.turnstile) {
        resolve();
      }
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile-script'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function TurnstileField({ resetKey, onToken, onUnavailable }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onUnavailableRef = useRef(onUnavailable);
  const [message, setMessage] = useState('');

  onTokenRef.current = onToken;
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    let cancelled = false;
    onTokenRef.current('');
    onUnavailableRef.current(false);
    setMessage('');

    async function setup() {
      try {
        const res = await fetch('/api/turnstile.php');
        const data = await res.json().catch(() => ({}));
        const siteKey = typeof data.siteKey === 'string' ? data.siteKey.trim() : '';
        if (!res.ok || siteKey === '') {
          if (!cancelled) {
            setMessage(UNAVAILABLE);
            onUnavailableRef.current(true);
          }
          return;
        }
        await loadTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) {
          return;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          language: 'fr',
          appearance: 'always',
          callback: (token) => onTokenRef.current(token || ''),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      } catch {
        if (!cancelled) {
          setMessage(UNAVAILABLE);
          onUnavailableRef.current(true);
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [resetKey]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} />
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Wire `BookingForm`**

In `apps/web/src/components/BookingForm.jsx`:

1. Import `TurnstileField`.
2. State: `turnstileToken` (`''`), `turnstileReset` (`0`), `turnstileUnavailable` (`false`).
3. `resetTurnstile`: `setTurnstileToken(''); setTurnstileReset((n) => n + 1);`
4. In `onSubmit`, **before** `setSubmitting(true)`:

```javascript
    if (!turnstileToken) {
      toast.error('Vérification anti-robot requise.');
      return;
    }
```

5. Pass `turnstileToken` into `createBooking({ ... existing fields, turnstileToken })`.
6. After `onSuccess?.(result.booking)` and in the `catch` (not on the early toast), call `resetTurnstile()`.
7. Between the `players` `FormField` and the submit `Button`:

```jsx
        <TurnstileField
          resetKey={`${room.slug}:${iso}:${time}:${turnstileReset}`}
          onToken={setTurnstileToken}
          onUnavailable={setTurnstileUnavailable}
        />
        <Button type="submit" disabled={submitting || turnstileUnavailable || !turnstileToken} className="h-11 w-full">
```

`createBooking` already `JSON.stringify(payload)` — no change required in `booking.js` unless a whitelist appears. Confirm the function still forwards unknown keys.

- [ ] **Step 3: Commit**

Skip unless the user explicitly asks.

---

### Task 4: README, dummy keys locales, vérif navigateur

**Files:**

- Modify: `README.md`
- Modify: `.env` (local, never stage)

**Interfaces:**

- Consumes: Tasks 1–3
- Produces: dev local fonctionnel avec dummy Cloudflare always-pass

- [ ] **Step 1: README**

After the « Prévisualiser » section (before « Déployer »), add:

```markdown
### Turnstile (anti-robot réservation)

Le formulaire public de réservation exige Cloudflare Turnstile. Les clés ne sont **pas** dans le build : elles vivent dans `.env` / hPanel (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).

En local, sans compte Cloudflare, coller les clés dummy always-pass :

```
TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
```

Puis relancer `npm run dev` (PHP relit le `.env`).

En production : créer un widget **Managed** sur [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile), hostnames = `localhost` + le domaine public, coller les vraies clés dans hPanel. Le deploy n’upload pas les `.env`. Sans clés : la réservation répond 503.
```

- [ ] **Step 2: Dummy keys in local `.env`**

Append the two dummy lines to the repo-root `.env` if absent. Do **not** `git add .env`.

- [ ] **Step 3: Browser verification** (`npm run dev`, http://localhost:3000)

Clés dummy. Exercer comme un visiteur, pas seulement un screenshot :

1. Page salle (calendrier) : choisir un créneau. Widget visible entre joueurs et bouton. Bouton inactif tant que le badge n’a pas fourni de jeton, puis actif.
2. Page `/reserver` (timeline) : même comportement (même `BookingForm`).
3. Submit sans jeton (bouton encore disabled : tenter via DevTools en retirant `disabled` si besoin) : toast `Vérification anti-robot requise.`, **aucun** `POST /api/bookings.php`.
4. Submit valide : résa créée, écran succès.
5. Forcer une 409 (réserver le même créneau une 2ᵉ fois, ou fermer le créneau dans `/maitre`) : toast d’erreur, widget reset, second essai possible **sans** recharger.

Si le GET `/api/turnstile.php` est 503 : message `Réservation temporairement indisponible.`, bouton disabled.

- [ ] **Step 4: Commit**

Skip unless the user explicitly asks.
