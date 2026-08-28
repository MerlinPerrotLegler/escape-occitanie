# Backoffice Maître Thibaut — avis et Hall of fame

Date: 2026-08-28  
Statut: validé en conversation, en attente de relecture du spec

## Problème

Les avis (« Les survivants témoignent ») et le top 3 des records (« Hall of fame ») sont aujourd’hui écrits en dur dans `apps/web/src/data/rooms.js`. La direction doit pouvoir les mettre à jour sans redéployer le site.

## Objectif

Une page secrète `/maitre-thibaut` permet de modifier :

- **3 avis** : nom, ville, texte, note (1 à 5 étoiles)
- **Top 3 par salle** : nom d’équipe + temps `MM:SS` pour *Le Directeur* et *Le Vaisseau Fantôme*

Les changements sont persistés en MySQL Hostinger et affichés tout de suite sur l’accueil public.

Hors scope : réservations, salles, textes marketing, ajout/suppression d’avis ou de lignes de records.

## Contraintes

- Front actuel : SPA Vite/React, hébergement Hostinger (PHP + MySQL).
- Identifiants manager déjà prévus dans `.env` : `MANAGER_EMAIL`, `MANAGER_PASSWORD`, `AUTH_SECRET`, `DATABASE_URL`.
- Pas de header/footer public sur le backoffice.
- Accueil : si l’API est indisponible, garder les valeurs actuellement en dur dans le code.

## Architecture

```
Navigateur
  GET /                     HomePage → GET /api/content.php
  /maitre-thibaut           page React isolée
    POST /api/login.php
    GET  /api/me.php
    POST /api/content.php   (save, session requise)
    POST /api/logout.php

apps/web/public/api/*.php   → MySQL Hostinger
```

- Les fichiers PHP vivent dans `apps/web/public/api/` et sont copiés tels quels dans le build (`dist/apps/web/api/`).
- En local, `npm run dev` lance Vite **et** `php -S 127.0.0.1:8080` sur `apps/web/public`. Vite proxy `/api` → `http://127.0.0.1:8080/api`. PHP CLI est requis en local.
- En production, Hostinger exécute les `.php`. Un `.htaccess` à la racine du site :
  - laisse passer `/api/`
  - interdit le téléchargement de `.env` / configs
  - redirige les autres routes SPA vers `index.html` (nécessaire pour `/maitre-thibaut`)

Le mot de passe MySQL peut contenir des caractères spéciaux (`?`, `@`, etc.). L’API PHP ne parse pas `DATABASE_URL` naïvement : elle utilise des variables discrètes (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`) et, en secours, un parseur qui décode le mot de passe de `DATABASE_URL`.

## Modèle de données

Deux tables, créées automatiquement au premier appel si elles n’existent pas (`CREATE TABLE IF NOT EXISTS`). Si une table est vide, seed avec le contenu actuel de `rooms.js`.

### `site_reviews`

| Colonne     | Type           | Règle                          |
|-------------|----------------|--------------------------------|
| `slot`      | TINYINT PK     | 1, 2 ou 3                      |
| `name`      | VARCHAR(80)    | obligatoire                    |
| `city`      | VARCHAR(80)    | obligatoire                    |
| `text`      | VARCHAR(600)   | obligatoire                    |
| `stars`     | TINYINT        | 1 à 5                          |
| `updated_at`| TIMESTAMP      | auto                           |

### `site_records`

| Colonne     | Type           | Règle                                      |
|-------------|----------------|--------------------------------------------|
| `room_slug` | VARCHAR(32)    | `directeur` ou `vaisseau`                  |
| `rank`      | TINYINT        | 1, 2 ou 3                                  |
| `team`      | VARCHAR(80)    | obligatoire                                |
| `time`      | CHAR(5)        | `MM:SS`, minutes 00–59, secondes 00–59     |
| `updated_at`| TIMESTAMP      | auto                                       |

PK : `(room_slug, rank)`.

Le backoffice envoie **toujours** les 3 avis + les 6 records en une seule sauvegarde. Pas de 4e ligne, pas de suppression.

Seed initial des étoiles : 5 pour les 3 avis actuels.

## Auth

- Page `/maitre-thibaut` : formulaire email + mot de passe, bouton « Entrer dans le bureau ».
- `POST /api/login.php` compare (timing-safe) à `MANAGER_EMAIL` / `MANAGER_PASSWORD`.
- Succès : cookie de session `httpOnly`, `Secure` en HTTPS, `SameSite=Lax`, signé avec `AUTH_SECRET`.
- Échec : message générique « Identifiants incorrects ». Max 5 essais par IP / 15 minutes, compteur stocké dans un fichier de `sys_get_temp_dir()` (pas en MySQL).
- `GET /api/me.php` : 200 si session valide, 401 sinon.
- `POST /api/logout.php` : détruit le cookie.
- Les routes d’écriture refusent toute requête sans session (401).

Pas de table `managers`. Un seul compte, celui du `.env`.

## API

| Méthode | URL                 | Auth | Rôle |
|---------|---------------------|------|------|
| GET     | `/api/content.php`  | non  | `{ reviews: [3], records: { directeur: [3], vaisseau: [3] } }` |
| POST    | `/api/content.php`  | oui  | remplace les 3 avis et 6 records après validation |
| POST    | `/api/login.php`    | non  | `{ email, password }` |
| POST    | `/api/logout.php`   | oui  | fin de session |
| GET     | `/api/me.php`       | oui  | `{ name, email }` |

Validation POST content :

- exactement 3 avis, slots 1–3
- nom / ville / texte non vides (trim), longueurs max respectées
- `stars` entier 1–5
- exactement 3 records par `directeur` et `vaisseau`, ranks 1–3
- `team` non vide, `time` regex `^[0-5][0-9]:[0-5][0-9]$`

Réponses JSON, erreurs `{ error: "…" }` avec code HTTP 400 / 401 / 429 / 500.

## Front

### Accueil

- `HomePage` charge `GET /api/content.php` au montage.
- Succès : avis et records API remplacent `REVIEWS` et `room.records`.
- Échec / timeout : valeurs actuelles de `rooms.js`.
- Les étoiles d’un avis suivent `review.stars` (plus hardcodé à 5). `aria-label` : « N étoiles sur 5 ».

### Backoffice `/maitre-thibaut`

- Route React dédiée. `App` n’affiche pas `SiteHeader` / `SiteFooter` sur ce chemin.
- Meta `noindex, nofollow`. Entrée `Disallow: /maitre-thibaut` dans `robots.txt` (à créer si absent).
- Look du site (fond sombre, or), titre du type « Bureau de Maître Thibaut ».
- Non connecté : formulaire de login.
- Connecté :
  - 3 cartes avis : nom, ville, textarea, sélecteur d’étoiles 1–5 cliquable
  - 2 blocs records (noms courts des salles) : 3 lignes équipe + temps
  - « Enregistrer » (toute la page) + « Se déconnecter » + lien « Voir le site »
- Toast de succès après save.
- Session expirée au save : retour au login **sans vider le formulaire** (état local conservé) pour ne pas perdre la saisie.

## Fichiers PHP (unités)

Chaque fichier a un rôle unique :

- `bootstrap.php` — charge config, PDO, session, helpers JSON / auth / rate-limit (inclus, pas d’entrée HTTP)
- `content.php` — GET public + POST authentifié
- `login.php` / `logout.php` / `me.php` — auth
- `.htaccess` (dans `api/` et à la racine `public/`) — protection secrets + rewrite SPA

Config : `public/api/.env` (gitignoré), modèle `public/api/.env.example` sans secrets. En production, ce fichier est déposé à côté des PHP sur Hostinger. Ne jamais committer `MANAGER_PASSWORD` ni le mot de passe MySQL.

## Erreurs

| Cas | Comportement |
|-----|----------------|
| MySQL injoignable (accueil) | fallback `rooms.js`, pas d’écran d’erreur |
| MySQL injoignable (save) | toast / message « Enregistrement impossible, réessaie. » |
| Validation | 400, le formulaire reste rempli, message de champ |
| Mauvais login | 401, message générique |
| Trop d’essais | 429, « Réessaie dans quelques minutes. » |
| Session expirée au save | 401, écran login, formulaire conservé |
| PHP absent en local | le proxy Vite échoue → accueil en fallback ; backoffice affiche que l’API est injoignable |

## Tests (manuel, avant de déclarer terminé)

1. Login faux → message générique, pas de session.
2. Login bon → formulaire prérempli avec le seed (contenu actuel du site).
3. Modifier un avis (dont les étoiles) + un record → Enregistrer → toast.
4. Ouvrir `/` : les nouvelles valeurs s’affichent, étoiles correctes.
5. Logout → `/api/content.php` POST sans cookie → 401.
6. Couper PHP / mauvaise config : l’accueil montre encore les valeurs de `rooms.js`.
7. `/maitre-thibaut` n’apparaît pas dans le header/footer ; `noindex` présent.

## Hors scope volontaire

- Compte manager en base, reset mot de passe, 2FA
- Ajout/suppression d’avis ou de records au-delà des 3+3
- Recalcul automatique du classement
- Édition des salles, contact, hero
- Tests automatisés e2e (le parcours manuel ci-dessus suffit pour cette itération)
