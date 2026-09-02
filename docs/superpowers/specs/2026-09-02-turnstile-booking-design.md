# Cloudflare Turnstile — réservation publique

Date: 2026-09-02  
Statut: validé

## Problème

`POST /api/bookings.php` crée une réservation dès que nom / e-mail / téléphone / créneau sont valides. Un bot peut spammer des demandes (e-mails, créneaux bloqués). Pas de captcha aujourd’hui. La page contact n’envoie rien.

## Objectif

Protéger **uniquement** la création publique de réservation avec **Cloudflare Turnstile**, widget **managed**, thème sombre. Vérification **côté serveur**, fail-closed. Clés dans l’env PHP (comme SMTP), pas dans le bundle Vite.

Approche retenue : **A** — le front lit le site key via `GET /api/turnstile.php`, envoie `turnstileToken` avec la résa, PHP appelle `siteverify` avant tout INSERT.

## Périmètre

| Surface | Turnstile |
|---|---|
| `BookingForm` (calendrier salle + timeline `/reserver`) | oui |
| Login `/maitre` | non (rate-limit existant) |
| PATCH / confirm / mail manager | non |
| Page contact | non (pas de formulaire d’envoi) |

## Flux

1. Montage de `BookingForm` → `GET /api/turnstile.php` → `{ siteKey }`.
2. Chargement unique de `https://challenges.cloudflare.com/turnstile/v0/api.js` puis `turnstile.render` (pas de lib npm).
3. Submit → `POST /api/bookings.php` avec les champs actuels **plus** `turnstileToken`.
4. PHP : `mt_turnstile_verify` **avant** validation invité et verrou créneau. Succès Cloudflare → création inchangée. Échec → pas d’INSERT.
5. Jeton **à usage unique** : reset du widget après succès, après erreur API, et si le visiteur change de créneau (`iso` / `time` / `room`).

## Front

Fichiers : `apps/web/src/components/TurnstileField.jsx` (nouveau), `BookingForm.jsx`, `apps/web/src/lib/booking.js` (`createBooking` transmet `turnstileToken`).

`TurnstileField` :

- Script chargé une seule fois (garde-fou si deux montages).
- `turnstile.render(container, { sitekey, theme: 'dark', language: 'fr', appearance: 'always', callback, 'expired-callback', 'error-callback' })`.
- Placement : **entre** le sélecteur de joueurs et le bouton « Réserver ce créneau ».
- Au démontage : `turnstile.remove(widgetId)`.
- Reset : `turnstile.reset(widgetId)` puis jeton local vidé.

Comportement du bouton :

- Désactivé si : soumission en cours, site key absente / GET en échec, ou pas encore de jeton.
- GET en échec ou 503 : message sous le widget `Réservation temporairement indisponible.` (même phrase que l’API 503).
- Clic submit sans jeton (course) : pas d’appel `bookings.php`, toast `Vérification anti-robot requise.`

Textes en dur en français. Pas de nouvelles balises dans `contribution/`.

Le type **Managed** se règle dans le tableau Cloudflare au moment de créer le widget (pas un paramètre client). En local, les clés dummy always-pass n’affichent souvent qu’un badge discret.

## API

### `GET /api/turnstile.php`

Fichier nouveau. `Cache-Control: no-store`.

- `TURNSTILE_SITE_KEY` non vide → 200 `{ "siteKey": "…" }`
- sinon → 503 `{ "error": "Réservation temporairement indisponible." }`

Ne renvoie jamais le secret.

### `mt_turnstile_verify`

Fichier `apps/web/public/api/lib/turnstile.php`. Chargé depuis `bootstrap.php`.

Signature : `mt_turnstile_verify(array $env, string $token, string $ip, ?callable $post = null): array`

Retour : `{ ok: bool, status: int, error: string }`. `status` est le HTTP à renvoyer au client. `error` est le message.

Le 4ᵉ argument est un POST injectable pour les tests. Défaut : cURL `POST` `application/x-www-form-urlencoded` vers `https://challenges.cloudflare.com/turnstile/v0/siteverify`, timeout 8 s, champs `secret`, `response`, `remoteip` (`mt_client_ip()`). Pas de Composer.

Règles, dans cet ordre :

| Condition | `status` | `error` |
|---|---|---|
| `TURNSTILE_SECRET_KEY` vide, ou cURL absent | 503 | Réservation temporairement indisponible. |
| Jeton vide (trim) | 400 | Vérification anti-robot requise. |
| Transport KO (timeout, HTTP ≠ 200, JSON illisible) | 503 | Réservation temporairement indisponible. |
| `success` n’est pas `true` | 400 | Vérification anti-robot échouée, réessaie. |
| `success === true` | — | `ok: true` |

Ne pas inspecter `hostname` / `action` au-delà de `success` (YAGNI).

### `POST /api/bookings.php` (création, sans `?id`)

Tout de suite après `mt_read_json()`, avant salle / date / nom :

```
$checked = mt_turnstile_verify($env, (string) ($body['turnstileToken'] ?? ''), mt_client_ip());
if (!$checked['ok']) {
    mt_json_out($checked['status'], ['error' => $checked['error']]);
}
```

Les autres POST (confirm, mail) et le PATCH restent sans Turnstile.

## Env

Noms : `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.

- `.env.example` et `apps/web/public/api/.env.example` : clés listées, **valeurs vides**.
- `mt_load_env` : les deux noms dans la liste `getenv()`, comme `AUTH_SECRET`.
- Le deploy n’upload pas les `.env`. Prod = hPanel / `.env` serveur.

Local (README) : dummy Cloudflare always-pass, sans compte :

- site key `1x00000000000000000000AA`
- secret `1x0000000000000000000000000000000AA`

Prod : widget Turnstile **Managed**, hostnames = `localhost` plus le(s) domaine(s) réellement servis. Copier les vraies clés en local pour tester le widget réel, ou garder les dummy.

Si les clés prod manquent : fail-closed (GET 503, POST 503). Pas de mode « captcha désactivé ».

## Tests

PHP, `apps/web/tools/test-api-lib.php`, callback `$post` factice — **aucun** appel réseau :

- secret vide → 503 indisponible
- jeton vide (secret présent) → 400 requise
- `$post` renvoie `{ success: true }` → ok
- `$post` renvoie `{ success: false }` → 400 échouée
- `$post` simule timeout / HTTP 500 → 503 indisponible

Pas de test JS du widget.

Vérification navigateur avant clôture (clés dummy) :

1. Formulaire salle et timeline `/reserver` : widget présent, bouton inactif tant que le badge n’est pas prêt.
2. Submit sans jeton : toast, pas d’appel `bookings.php`.
3. Submit valide : résa créée.
4. Forcer une 409 (créneau pris) : widget reset, second essai possible sans recharger la page.

## Hors scope

- Login Maître Thibault, honeypot, rate-limit réservation.
- XML `contribution/`.
- Lib React Turnstile, `VITE_TURNSTILE_*`.
- Retirer le logo Cloudflare (Enterprise).
- Vérifier `hostname` renvoyé par siteverify.
