# Backoffice Maître Thibault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à la direction d’éditer les 3 avis et le top 3 des records depuis `/maitre-Thibault`, persistés en MySQL et affichés sur l’accueil.

**Architecture:** SPA Vite/React inchangée côté public. API PHP dans `apps/web/public/api/` (exécutée par Hostinger en prod, par `php -S` en local via proxy Vite). Auth cookie HMAC (`AUTH_SECRET` + `MANAGER_EMAIL` / `MANAGER_PASSWORD`). Accueil : `GET /api/content.php` avec fallback `rooms.js`.

**Tech Stack:** PHP 8 + PDO MySQL, Vite 7 proxy, React 18, react-router-dom 7, shadcn/ui (Input, Textarea, Button), sonner, Helmet.

**Spec:** `docs/superpowers/specs/2026-08-28-maitre-Thibault-backoffice-design.md`

## Global Constraints

- Ne pas committer sauf demande explicite de l’utilisateur.
- Un seul compte manager : variables d’environnement, pas de table `managers`.
- Toujours exactement 3 avis (slots 1–3) et 3 records par salle (`directeur`, `vaisseau`).
- Temps records : regex `^[0-5][0-9]:[0-5][0-9]$` (00:00–59:59).
- Étoiles avis : entier 1–5.
- Cookie : `httpOnly`, `SameSite=Lax`, `Secure` seulement en HTTPS.
- Rate limit login : 5 essais / IP / 15 min, fichier dans `sys_get_temp_dir()`.
- Secrets : jamais dans git. `apps/web/public/api/.env` gitignoré.
- Accueil : si l’API échoue, garder `REVIEWS` / `room.records` de `rooms.js`.
- `/maitre-Thibault` : pas de SiteHeader/SiteFooter, `noindex`, absent du menu.
- Copy login : bouton « Entrer dans le bureau », erreur « Identifiants incorrects », 429 « Réessaie dans quelques minutes. »
- PHP local : `php -S 127.0.0.1:8080 -t apps/web/public` ; Vite proxy `/api` → ce serveur.

## File map

Create:

- `apps/web/public/api/lib/env.php` — charge `.env`, parse `DATABASE_URL` (mot de passe avec `?`)
- `apps/web/public/api/lib/validate.php` — validation payload avis/records
- `apps/web/public/api/lib/auth.php` — HMAC cookie, rate limit
- `apps/web/public/api/lib/db.php` — PDO, schema, seed, read/write
- `apps/web/public/api/lib/http.php` — JSON helpers, CORS same-origin
- `apps/web/public/api/bootstrap.php` — assemble les libs
- `apps/web/public/api/content.php` — GET public + POST auth
- `apps/web/public/api/login.php` / `logout.php` / `me.php`
- `apps/web/public/api/.htaccess` — deny `.env`
- `apps/web/public/api/.env.example`
- `apps/web/public/.htaccess` — SPA fallback + deny `.env`
- `apps/web/tools/test-api-lib.php` — tests CLI sans MySQL
- `apps/web/src/lib/siteContent.js` — fetch/save content + auth helpers
- `apps/web/src/pages/MaitreThibaultPage.jsx`

Modify:

- `apps/web/vite.config.js` — `server.proxy['/api']`
- `apps/web/package.json` — `php:serve` + `dev` concurrently
- `apps/web/src/App.jsx` — layout public vs backoffice
- `apps/web/src/pages/HomePage.jsx` — load API + étoiles dynamiques
- `apps/web/src/data/rooms.js` — `stars: 5` sur chaque avis (fallback)
- `apps/web/public/robots.txt` — `Disallow: /maitre-Thibault`
- `.gitignore` — `apps/web/public/api/.env`

---

### Task 1: Libs PHP (env, validate, auth) + tests CLI

**Files:**

- Create: `apps/web/public/api/lib/env.php`
- Create: `apps/web/public/api/lib/validate.php`
- Create: `apps/web/public/api/lib/auth.php`
- Create: `apps/web/public/api/lib/http.php`
- Create: `apps/web/tools/test-api-lib.php`

**Interfaces:**

- Consumes: nothing
- Produces:
  - `mt_load_env(?string $startDir = null): array` — merge walk-up `.env`
  - `mt_parse_database_url(string $url): array{host,port,user,pass,dbname}`
  - `mt_validate_content(array $data): array{ok:bool,error:?string,value:?array}`
  - `mt_issue_cookie(string $email, string $secret, int $ttl = 604800): string`
  - `mt_verify_cookie(?string $cookie, string $secret): ?array{email:string}`
  - `mt_rate_limit_hit(string $ip, int $max = 5, int $window = 900): bool` (true = bloqué)
  - `mt_json_out(int $status, array $body): void`

- [ ] **Step 1: Write the failing CLI test**

Create `apps/web/tools/test-api-lib.php`:

```php
<?php
declare(strict_types=1);

$root = dirname(__DIR__) . '/public/api/lib';
require $root . '/env.php';
require $root . '/validate.php';
require $root . '/auth.php';

$failed = 0;
function expect($cond, $msg) {
    global $failed;
    if (!$cond) {
        fwrite(STDERR, "FAIL: $msg\n");
        $failed++;
    }
}

$url = 'mysql://u582943705_escapeocc:2?fypiFc@srv1269.hstgr.io:3306/u582943705_escapeocc';
$parsed = mt_parse_database_url($url);
expect(($parsed['pass'] ?? '') === '2?fypiFc', 'password with ? parsed');
expect(($parsed['user'] ?? '') === 'u582943705_escapeocc', 'user parsed');
expect(($parsed['host'] ?? '') === 'srv1269.hstgr.io', 'host parsed');
expect((int)($parsed['port'] ?? 0) === 3306, 'port parsed');
expect(($parsed['dbname'] ?? '') === 'u582943705_escapeocc', 'db parsed');

$bad = mt_validate_content(['reviews' => [], 'records' => []]);
expect($bad['ok'] === false, 'empty payload rejected');

$okPayload = [
    'reviews' => [
        ['slot' => 1, 'name' => 'A', 'city' => 'Albi', 'text' => 'Super', 'stars' => 5],
        ['slot' => 2, 'name' => 'B', 'city' => 'Toulouse', 'text' => 'Top', 'stars' => 4],
        ['slot' => 3, 'name' => 'C', 'city' => 'Castres', 'text' => 'Cool', 'stars' => 1],
    ],
    'records' => [
        'directeur' => [
            ['rank' => 1, 'team' => 'Alpha', 'time' => '38:42'],
            ['rank' => 2, 'team' => 'Beta', 'time' => '41:07'],
            ['rank' => 3, 'team' => 'Gamma', 'time' => '44:55'],
        ],
        'vaisseau' => [
            ['rank' => 1, 'team' => 'Crew', 'time' => '39:18'],
            ['rank' => 2, 'team' => 'Sail', 'time' => '42:51'],
            ['rank' => 3, 'team' => 'Win', 'time' => '47:03'],
        ],
    ],
];
$ok = mt_validate_content($okPayload);
expect($ok['ok'] === true, 'valid payload accepted');

$stars = $okPayload;
$stars['reviews'][0]['stars'] = 6;
expect(mt_validate_content($stars)['ok'] === false, 'stars 6 rejected');

$time = $okPayload;
$time['records']['directeur'][0]['time'] = '61:00';
expect(mt_validate_content($time)['ok'] === false, 'time 61:00 rejected');

$secret = 'test-secret-key-for-hmac';
$cookie = mt_issue_cookie('contact@example.fr', $secret, 60);
$session = mt_verify_cookie($cookie, $secret);
expect(($session['email'] ?? '') === 'contact@example.fr', 'cookie roundtrip');
expect(mt_verify_cookie($cookie, 'wrong') === null, 'bad secret rejected');
expect(mt_verify_cookie('tampered', $secret) === null, 'tamper rejected');

$ip = 'test-ip-' . bin2hex(random_bytes(4));
expect(mt_rate_limit_hit($ip) === false, 'first hit allowed');
for ($i = 0; $i < 4; $i++) {
    mt_rate_limit_hit($ip);
}
expect(mt_rate_limit_hit($ip) === true, '6th hit blocked');

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php apps/web/tools/test-api-lib.php`

Expected: FAIL with missing file / undefined function.

- [ ] **Step 3: Write `env.php`**

```php
<?php
declare(strict_types=1);

function mt_parse_database_url(string $url): array {
    if (!preg_match('#^mysql://#i', $url)) {
        throw new InvalidArgumentException('DATABASE_URL must start with mysql://');
    }
    $rest = preg_replace('#^mysql://#i', '', $url);
    $at = strrpos($rest, '@');
    if ($at === false) {
        throw new InvalidArgumentException('DATABASE_URL missing @host');
    }
    $userPass = substr($rest, 0, $at);
    $hostDb = substr($rest, $at + 1);
    $colon = strpos($userPass, ':');
    $user = $colon === false ? $userPass : substr($userPass, 0, $colon);
    $pass = $colon === false ? '' : substr($userPass, $colon + 1);
    $slash = strpos($hostDb, '/');
    $hostPort = $slash === false ? $hostDb : substr($hostDb, 0, $slash);
    $dbname = $slash === false ? '' : substr($hostDb, $slash + 1);
    $dbname = explode('?', $dbname, 2)[0];
    $hcolon = strrpos($hostPort, ':');
    if ($hcolon !== false && ctype_digit(substr($hostPort, $hcolon + 1))) {
        $host = substr($hostPort, 0, $hcolon);
        $port = (int) substr($hostPort, $hcolon + 1);
    } else {
        $host = $hostPort;
        $port = 3306;
    }
    return [
        'user' => rawurldecode($user),
        'pass' => rawurldecode($pass),
        'host' => $host,
        'port' => $port,
        'dbname' => $dbname,
    ];
}

function mt_parse_env_file(string $path): array {
    if (!is_readable($path)) {
        return [];
    }
    $out = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (!str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        if ((str_starts_with($v, '"') && str_ends_with($v, '"')) || (str_starts_with($v, "'") && str_ends_with($v, "'"))) {
            $v = substr($v, 1, -1);
        }
        $out[$k] = $v;
    }
    return $out;
}

function mt_load_env(?string $startDir = null): array {
    $dir = $startDir ?? __DIR__ . '/..';
    $merged = [];
    for ($i = 0; $i < 8; $i++) {
        $merged = array_merge(mt_parse_env_file($dir . '/.env'), $merged);
        $parent = dirname($dir);
        if ($parent === $dir) {
            break;
        }
        $dir = $parent;
    }
    foreach (['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'DATABASE_URL', 'MANAGER_EMAIL', 'MANAGER_PASSWORD', 'MANAGER_NAME', 'AUTH_SECRET'] as $key) {
        $g = getenv($key);
        if ($g !== false && $g !== '') {
            $merged[$key] = $g;
        }
    }
    return $merged;
}
```

- [ ] **Step 4: Write `validate.php`**

```php
<?php
declare(strict_types=1);

function mt_validate_content(array $data): array {
    $reviewsIn = $data['reviews'] ?? null;
    $recordsIn = $data['records'] ?? null;
    if (!is_array($reviewsIn) || count($reviewsIn) !== 3) {
        return ['ok' => false, 'error' => 'Il faut exactement 3 avis.', 'value' => null];
    }
    if (!is_array($recordsIn) || !isset($recordsIn['directeur'], $recordsIn['vaisseau'])) {
        return ['ok' => false, 'error' => 'Records manquants pour une salle.', 'value' => null];
    }
    $reviews = [];
    $slots = [];
    foreach ($reviewsIn as $row) {
        if (!is_array($row)) {
            return ['ok' => false, 'error' => 'Avis invalide.', 'value' => null];
        }
        $slot = (int) ($row['slot'] ?? 0);
        $name = trim((string) ($row['name'] ?? ''));
        $city = trim((string) ($row['city'] ?? ''));
        $text = trim((string) ($row['text'] ?? ''));
        $stars = (int) ($row['stars'] ?? 0);
        if ($slot < 1 || $slot > 3 || isset($slots[$slot])) {
            return ['ok' => false, 'error' => 'Slots d’avis invalides.', 'value' => null];
        }
        if ($name === '' || $city === '' || $text === '') {
            return ['ok' => false, 'error' => 'Nom, ville et texte sont obligatoires.', 'value' => null];
        }
        if (mb_strlen($name) > 80 || mb_strlen($city) > 80 || mb_strlen($text) > 600) {
            return ['ok' => false, 'error' => 'Un champ avis est trop long.', 'value' => null];
        }
        if ($stars < 1 || $stars > 5) {
            return ['ok' => false, 'error' => 'La note doit être entre 1 et 5 étoiles.', 'value' => null];
        }
        $slots[$slot] = true;
        $reviews[] = compact('slot', 'name', 'city', 'text', 'stars');
    }
    usort($reviews, fn($a, $b) => $a['slot'] <=> $b['slot']);

    $records = [];
    foreach (['directeur', 'vaisseau'] as $slug) {
        $rows = $recordsIn[$slug] ?? null;
        if (!is_array($rows) || count($rows) !== 3) {
            return ['ok' => false, 'error' => 'Il faut exactement 3 records par salle.', 'value' => null];
        }
        $ranks = [];
        $clean = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                return ['ok' => false, 'error' => 'Record invalide.', 'value' => null];
            }
            $rank = (int) ($row['rank'] ?? 0);
            $team = trim((string) ($row['team'] ?? ''));
            $time = trim((string) ($row['time'] ?? ''));
            if ($rank < 1 || $rank > 3 || isset($ranks[$rank])) {
                return ['ok' => false, 'error' => 'Rangs de records invalides.', 'value' => null];
            }
            if ($team === '' || mb_strlen($team) > 80) {
                return ['ok' => false, 'error' => 'Nom d’équipe obligatoire (max 80).', 'value' => null];
            }
            if (!preg_match('/^[0-5][0-9]:[0-5][0-9]$/', $time)) {
                return ['ok' => false, 'error' => 'Temps au format MM:SS (00:00–59:59).', 'value' => null];
            }
            $ranks[$rank] = true;
            $clean[] = compact('rank', 'team', 'time');
        }
        usort($clean, fn($a, $b) => $a['rank'] <=> $b['rank']);
        $records[$slug] = $clean;
    }
    return ['ok' => true, 'error' => null, 'value' => ['reviews' => $reviews, 'records' => $records]];
}
```

- [ ] **Step 5: Write `auth.php`**

Cookie name `mt_auth`. Value: `v1.` + base64url(json `{email,exp}`) + `.` + hmac sha256 hex.

```php
<?php
declare(strict_types=1);

const MT_COOKIE = 'mt_auth';

function mt_b64url_encode(string $raw): string {
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function mt_b64url_decode(string $val): ?string {
    $pad = strlen($val) % 4;
    if ($pad) {
        $val .= str_repeat('=', 4 - $pad);
    }
    $out = base64_decode(strtr($val, '-_', '+/'), true);
    return $out === false ? null : $out;
}

function mt_issue_cookie(string $email, string $secret, int $ttl = 604800): string {
    $payload = json_encode(['email' => $email, 'exp' => time() + $ttl], JSON_UNESCAPED_SLASHES);
    $body = mt_b64url_encode($payload);
    $sig = hash_hmac('sha256', $body, $secret);
    return 'v1.' . $body . '.' . $sig;
}

function mt_verify_cookie(?string $cookie, string $secret): ?array {
    if (!$cookie || !$secret || !str_starts_with($cookie, 'v1.')) {
        return null;
    }
    $parts = explode('.', substr($cookie, 3), 2);
    if (count($parts) !== 2) {
        return null;
    }
    [$body, $sig] = $parts;
    $expected = hash_hmac('sha256', $body, $secret);
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $json = mt_b64url_decode($body);
    if ($json === null) {
        return null;
    }
    $data = json_decode($json, true);
    if (!is_array($data) || empty($data['email']) || empty($data['exp']) || time() >= (int) $data['exp']) {
        return null;
    }
    return ['email' => (string) $data['email']];
}

function mt_rate_limit_path(string $ip): string {
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . '/mt-login-' . hash('sha256', $ip);
}

function mt_rate_limit_hit(string $ip, int $max = 5, int $window = 900): bool {
    $file = mt_rate_limit_path($ip);
    $now = time();
    $hits = [];
    if (is_readable($file)) {
        $decoded = json_decode((string) file_get_contents($file), true);
        if (is_array($decoded)) {
            $hits = $decoded;
        }
    }
    $hits = array_values(array_filter($hits, fn($t) => is_int($t) && $t > $now - $window));
    $blocked = count($hits) >= $max;
    if (!$blocked) {
        $hits[] = $now;
    }
    file_put_contents($file, json_encode($hits), LOCK_EX);
    return $blocked;
}

function mt_set_auth_cookie(string $value, int $ttl = 604800): void {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie(MT_COOKIE, $value, [
        'expires' => time() + $ttl,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
    ]);
}

function mt_clear_auth_cookie(): void {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie(MT_COOKIE, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
    ]);
}
```

- [ ] **Step 6: Write `http.php`**

```php
<?php
declare(strict_types=1);

function mt_json_out(int $status, array $body): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function mt_read_json(): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function mt_client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}
```

- [ ] **Step 7: Run tests**

Run: `php apps/web/tools/test-api-lib.php`

Expected: `OK`

---

### Task 2: PDO, schema/seed, GET content

**Files:**

- Create: `apps/web/public/api/lib/db.php`
- Create: `apps/web/public/api/bootstrap.php`
- Create: `apps/web/public/api/content.php`
- Create: `apps/web/public/api/.env.example`

**Interfaces:**

- Consumes: `mt_load_env`, `mt_parse_database_url`, `mt_json_out`, `mt_validate_content`, `mt_verify_cookie`
- Produces:
  - `mt_pdo(array $env): PDO`
  - `mt_ensure_schema(PDO $pdo): void`
  - `mt_read_content(PDO $pdo): array{reviews,records}`
  - `mt_write_content(PDO $pdo, array $value): void`
  - GET `content.php` → 200 JSON

- [ ] **Step 1: Write `.env.example`**

```
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
DATABASE_URL=
MANAGER_EMAIL=
MANAGER_PASSWORD=
MANAGER_NAME=
AUTH_SECRET=
```

- [ ] **Step 2: Write `db.php`**

Seed values must match `apps/web/src/data/rooms.js` (reviews + records, stars 5).

```php
<?php
declare(strict_types=1);

function mt_pdo(array $env): PDO {
    if (!empty($env['MYSQL_HOST']) && !empty($env['MYSQL_DATABASE'])) {
        $host = $env['MYSQL_HOST'];
        $port = (int) ($env['MYSQL_PORT'] ?? 3306);
        $user = $env['MYSQL_USER'] ?? '';
        $pass = $env['MYSQL_PASSWORD'] ?? '';
        $dbname = $env['MYSQL_DATABASE'];
    } elseif (!empty($env['DATABASE_URL'])) {
        $p = mt_parse_database_url($env['DATABASE_URL']);
        $host = $p['host'];
        $port = $p['port'];
        $user = $p['user'];
        $pass = $p['pass'];
        $dbname = $p['dbname'];
    } else {
        throw new RuntimeException('MySQL config missing');
    }
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $dbname);
    return new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function mt_ensure_schema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS site_reviews (
        slot TINYINT NOT NULL PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        city VARCHAR(80) NOT NULL,
        text VARCHAR(600) NOT NULL,
        stars TINYINT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS site_records (
        room_slug VARCHAR(32) NOT NULL,
        rank TINYINT NOT NULL,
        team VARCHAR(80) NOT NULL,
        time CHAR(5) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (room_slug, rank)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $count = (int) $pdo->query('SELECT COUNT(*) FROM site_reviews')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare('INSERT INTO site_reviews (slot, name, city, text, stars) VALUES (?,?,?,?,?)');
        $stmt->execute([1, 'Élodie M.', 'Albi', "Une immersion incroyable ! Le bureau du directeur est bluffant de réalisme et les énigmes sont diaboliquement bien pensées. On a adhéré du début à la fin.", 5]);
        $stmt->execute([2, 'Thomas R.', 'Toulouse', "Le Vaisseau Fantôme nous a littéralement transportés. Un décor digne d'un film, une ambiance à frissonner et un game master au top. On reviendra !", 5]);
        $stmt->execute([3, 'Famille Garcia', 'Castres', "Parfait en famille : nos enfants de 11 et 14 ans ont participé à toutes les fouilles. Une heure passée beaucoup, beaucoup trop vite !", 5]);
    }
    $countR = (int) $pdo->query('SELECT COUNT(*) FROM site_records')->fetchColumn();
    if ($countR === 0) {
        $stmt = $pdo->prepare('INSERT INTO site_records (room_slug, rank, team, time) VALUES (?,?,?,?)');
        $stmt->execute(['directeur', 1, 'Les Limiers de Cordes', '38:42']);
        $stmt->execute(['directeur', 2, 'Section Enquête', '41:07']);
        $stmt->execute(['directeur', 3, 'Les Insoumis', '44:55']);
        $stmt->execute(['vaisseau', 1, "L'Équipage du Tarn", '39:18']);
        $stmt->execute(['vaisseau', 2, 'Les Moussaillons', '42:51']);
        $stmt->execute(['vaisseau', 3, 'Cap sur la Victoire', '47:03']);
    }
}

function mt_read_content(PDO $pdo): array {
    mt_ensure_schema($pdo);
    $reviews = $pdo->query('SELECT slot, name, city, text, stars FROM site_reviews ORDER BY slot ASC')->fetchAll();
    $rows = $pdo->query('SELECT room_slug, rank, team, time FROM site_records ORDER BY room_slug ASC, rank ASC')->fetchAll();
    $records = ['directeur' => [], 'vaisseau' => []];
    foreach ($rows as $row) {
        $slug = $row['room_slug'];
        if (!isset($records[$slug])) {
            continue;
        }
        $records[$slug][] = [
            'rank' => (int) $row['rank'],
            'team' => $row['team'],
            'time' => $row['time'],
        ];
    }
    foreach ($reviews as &$r) {
        $r['slot'] = (int) $r['slot'];
        $r['stars'] = (int) $r['stars'];
    }
    return ['reviews' => $reviews, 'records' => $records];
}

function mt_write_content(PDO $pdo, array $value): void {
    mt_ensure_schema($pdo);
    $pdo->beginTransaction();
    try {
        $upR = $pdo->prepare('INSERT INTO site_reviews (slot, name, city, text, stars) VALUES (?,?,?,?,?)
            ON DUPLICATE KEY UPDATE name=VALUES(name), city=VALUES(city), text=VALUES(text), stars=VALUES(stars)');
        foreach ($value['reviews'] as $r) {
            $upR->execute([$r['slot'], $r['name'], $r['city'], $r['text'], $r['stars']]);
        }
        $upT = $pdo->prepare('INSERT INTO site_records (room_slug, rank, team, time) VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE team=VALUES(team), time=VALUES(time)');
        foreach ($value['records'] as $slug => $rows) {
            foreach ($rows as $row) {
                $upT->execute([$slug, $row['rank'], $row['team'], $row['time']]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
```

- [ ] **Step 3: Write `bootstrap.php`**

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/env.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/validate.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/db.php';

function mt_boot(): array {
    $env = mt_load_env(__DIR__);
    return $env;
}

function mt_require_session(array $env): array {
    $secret = $env['AUTH_SECRET'] ?? '';
    $session = mt_verify_cookie($_COOKIE[MT_COOKIE] ?? null, $secret);
    if (!$session) {
        mt_json_out(401, ['error' => 'Session expirée.']);
    }
    return $session;
}
```

- [ ] **Step 4: Write `content.php` GET only for now** (POST 405 until Task 4)

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$env = mt_boot();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = mt_pdo($env);
} catch (Throwable $e) {
    mt_json_out(500, ['error' => 'Base de données injoignable.']);
}

if ($method === 'GET') {
    try {
        mt_json_out(200, mt_read_content($pdo));
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Lecture impossible.']);
    }
}

if ($method === 'POST') {
    mt_json_out(405, ['error' => 'POST not ready']);
}

mt_json_out(405, ['error' => 'Méthode non autorisée.']);
```

- [ ] **Step 5: Start PHP and curl GET**

Run:

```bash
php -S 127.0.0.1:8080 -t apps/web/public
```

In another terminal:

```bash
curl -sS -o /tmp/mt-content.json -w "%{http_code}" http://127.0.0.1:8080/api/content.php
```

Expected: `200` and JSON with 3 reviews (Élodie, Thomas, Famille Garcia) and records Directeur/Vaisseau matching `rooms.js`. If MySQL refuses the connection, fix `.env` / firewall Hostinger remote MySQL before continuing — do not fake the response.

---

### Task 3: login, logout, me

**Files:**

- Create: `apps/web/public/api/login.php`
- Create: `apps/web/public/api/logout.php`
- Create: `apps/web/public/api/me.php`

**Interfaces:**

- Consumes: `mt_boot`, `mt_rate_limit_hit`, `mt_issue_cookie`, `mt_set_auth_cookie`, `mt_require_session`
- Produces: POST login 200/401/429, GET me 200/401, POST logout 200

- [ ] **Step 1: Write `login.php`**

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

$env = mt_boot();
$ip = mt_client_ip();
if (mt_rate_limit_hit($ip)) {
    mt_json_out(429, ['error' => 'Réessaie dans quelques minutes.']);
}

$body = mt_read_json();
$email = trim((string) ($body['email'] ?? ''));
$password = (string) ($body['password'] ?? '');
$expectedEmail = (string) ($env['MANAGER_EMAIL'] ?? '');
$expectedPass = (string) ($env['MANAGER_PASSWORD'] ?? '');
$secret = (string) ($env['AUTH_SECRET'] ?? '');

$ok = $expectedEmail !== '' && $expectedPass !== '' && $secret !== ''
    && hash_equals($expectedEmail, $email)
    && hash_equals($expectedPass, $password);

if (!$ok) {
    mt_json_out(401, ['error' => 'Identifiants incorrects']);
}

$ttl = 604800;
mt_set_auth_cookie(mt_issue_cookie($email, $secret, $ttl), $ttl);
mt_json_out(200, [
    'email' => $email,
    'name' => (string) ($env['MANAGER_NAME'] ?? 'Direction'),
]);
```

- [ ] **Step 2: Write `me.php`**

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

$env = mt_boot();
$session = mt_require_session($env);
mt_json_out(200, [
    'email' => $session['email'],
    'name' => (string) ($env['MANAGER_NAME'] ?? 'Direction'),
]);
```

- [ ] **Step 3: Write `logout.php`**

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

mt_boot();
mt_clear_auth_cookie();
mt_json_out(200, ['ok' => true]);
```

- [ ] **Step 4: Curl the auth flow** (PHP server from Task 2 still running)

```bash
# bad login
curl -sS -w "\n%{http_code}\n" -H 'Content-Type: application/json' \
  -d '{"email":"x","password":"y"}' http://127.0.0.1:8080/api/login.php
# expect 401 Identifiants incorrects

# me without cookie
curl -sS -w "\n%{http_code}\n" http://127.0.0.1:8080/api/me.php
# expect 401

# good login — use MANAGER_EMAIL / MANAGER_PASSWORD from repo .env, do not print them in logs
curl -sS -c /tmp/mt-cookies.txt -w "\n%{http_code}\n" -H 'Content-Type: application/json' \
  -d @- http://127.0.0.1:8080/api/login.php <<EOF
{"email":"<MANAGER_EMAIL>","password":"<MANAGER_PASSWORD>"}
EOF
# expect 200

curl -sS -b /tmp/mt-cookies.txt -w "\n%{http_code}\n" http://127.0.0.1:8080/api/me.php
# expect 200

curl -sS -b /tmp/mt-cookies.txt -c /tmp/mt-cookies.txt -X POST http://127.0.0.1:8080/api/logout.php
curl -sS -b /tmp/mt-cookies.txt -w "\n%{http_code}\n" http://127.0.0.1:8080/api/me.php
# expect 401
```

---

### Task 4: POST content (save)

**Files:**

- Modify: `apps/web/public/api/content.php`

**Interfaces:**

- Consumes: `mt_require_session`, `mt_validate_content`, `mt_write_content`
- Produces: POST → 200 `{reviews,records}` or 400/401/500

- [ ] **Step 1: Replace POST branch in `content.php`**

Full file:

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$env = mt_boot();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = mt_pdo($env);
} catch (Throwable $e) {
    mt_json_out(500, ['error' => 'Base de données injoignable.']);
}

if ($method === 'GET') {
    try {
        mt_json_out(200, mt_read_content($pdo));
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Lecture impossible.']);
    }
}

if ($method === 'POST') {
    mt_require_session($env);
    $parsed = mt_validate_content(mt_read_json());
    if (!$parsed['ok']) {
        mt_json_out(400, ['error' => $parsed['error']]);
    }
    try {
        mt_write_content($pdo, $parsed['value']);
        mt_json_out(200, mt_read_content($pdo));
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Enregistrement impossible, réessaie.']);
    }
}

mt_json_out(405, ['error' => 'Méthode non autorisée.']);
```

- [ ] **Step 2: Curl POST without cookie → 401; with cookie + invalid time → 400; valid save → 200 then GET reflects it**

Use the same cookie jar as Task 3. After the test, restore seed values (re-POST original rooms.js content) so the site is not left dirty.

---

### Task 5: Vite proxy, scripts, htaccess, gitignore

**Files:**

- Modify: `apps/web/vite.config.js` (`server` object)
- Modify: `apps/web/package.json` (`scripts`)
- Modify: `/Users/Shared/code/escape-v3/package.json` only if needed (prefer changing `apps/web` scripts)
- Modify: `.gitignore`
- Create: `apps/web/public/.htaccess`
- Create: `apps/web/public/api/.htaccess`

**Interfaces:**

- Consumes: PHP on `:8080`
- Produces: browser `:3000/api/*` proxied; SPA rewrite in prod

- [ ] **Step 1: Add proxy inside `server` in `apps/web/vite.config.js`**

```js
		proxy: {
			'/api': {
				target: 'http://127.0.0.1:8080',
				changeOrigin: true,
			},
		},
```

Keep existing `port`, `cors`, `headers`, `allowedHosts`, `fs`.

- [ ] **Step 2: Change `apps/web/package.json` scripts**

`concurrently` is already a root dep. From `apps/web`, call it via `npx concurrently` or the workspace binary.

```json
"php:serve": "php -S 127.0.0.1:8080 -t public",
"dev": "concurrently --kill-others --raw \"npm run php:serve\" \"vite --host :: --port 3000\""
```

`apps/web/package.json` does not currently depend on `concurrently`. Add it as a devDependency of `apps/web` **or** invoke `npx concurrently` from the existing root install. Prefer adding `"concurrently": "^10.0.4"` to `apps/web` `devDependencies` and run `npm install` at repo root.

- [ ] **Step 3: `.gitignore` append**

```
apps/web/public/api/.env
```

- [ ] **Step 4: `apps/web/public/.htaccess`**

```
<FilesMatch "^\.env">
  Require all denied
</FilesMatch>

RewriteEngine On
RewriteRule ^api/ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

- [ ] **Step 5: `apps/web/public/api/.htaccess`**

```
<FilesMatch "^\.env">
  Require all denied
</FilesMatch>
```

- [ ] **Step 6: Smoke**

`npm run dev --prefix apps/web` then `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/content.php`

Expected: `200`

---

### Task 6: Front — fetch content on HomePage

**Files:**

- Create: `apps/web/src/lib/siteContent.js`
- Modify: `apps/web/src/data/rooms.js` (`REVIEWS` — add `stars: 5` on each object)
- Modify: `apps/web/src/pages/HomePage.jsx`

**Interfaces:**

- Consumes: `GET /api/content.php` shape from Task 2
- Produces:
  - `fetchSiteContent(): Promise<{reviews, records}|null>`
  - HomePage state `reviews`, `recordsBySlug`

- [ ] **Step 1: Add `stars: 5` to each item in `REVIEWS`** in `rooms.js`. Do not change names/texts/records.

- [ ] **Step 2: Create `apps/web/src/lib/siteContent.js`**

```js
export async function fetchSiteContent() {
  try {
    const res = await fetch('/api/content.php', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.reviews) || !data?.records?.directeur || !data?.records?.vaisseau) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function loginManager(email, password) {
  const res = await fetch('/api/login.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Identifiants incorrects');
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function fetchMe() {
  const res = await fetch('/api/me.php', { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json();
}

export async function logoutManager() {
  await fetch('/api/logout.php', { method: 'POST', credentials: 'include' });
}

export async function saveSiteContent(payload) {
  const res = await fetch('/api/content.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Enregistrement impossible, réessaie.');
    err.status = res.status;
    throw err;
  }
  return data;
}
```

- [ ] **Step 3: HomePage — `useState` + `useEffect`**

Import `useState`, `useEffect` from React.

After `function HomePage() {`:

```jsx
  const [reviews, setReviews] = useState(REVIEWS);
  const [recordsBySlug, setRecordsBySlug] = useState(() =>
    Object.fromEntries(ROOM_LIST.map((room) => [room.slug, room.records]))
  );

  useEffect(() => {
    let cancelled = false;
    fetchSiteContent().then((data) => {
      if (cancelled || !data) return;
      setReviews(data.reviews);
      setRecordsBySlug(data.records);
    });
    return () => {
      cancelled = true;
    };
  }, []);
```

Import `fetchSiteContent` from `@/lib/siteContent`.

Replace `REVIEWS.map` with `reviews.map`. Star row:

```jsx
                <div
                  className="flex gap-1 text-primary"
                  aria-label={`${review.stars ?? 5} étoiles sur 5`}
                >
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={cn(
                        'h-4 w-4',
                        s < (review.stars ?? 5) ? 'fill-current' : 'text-muted-foreground'
                      )}
                      strokeWidth={s < (review.stars ?? 5) ? 0 : 1.5}
                    />
                  ))}
                </div>
```

Replace `{room.records.map(...)}` with `{(recordsBySlug[room.slug] || room.records).map(...)}`.

- [ ] **Step 4: Browser** — open `/`, section Avis & records still show seed data. Stop PHP: page still shows `rooms.js` fallback (reload).

---

### Task 7: Page `/maitre-Thibault`

**Files:**

- Create: `apps/web/src/pages/MaitreThibaultPage.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/main.jsx` (Toaster sonner once)

**Interfaces:**

- Consumes: `loginManager`, `fetchMe`, `logoutManager`, `fetchSiteContent`, `saveSiteContent`
- Produces: login UI + editor UI

- [ ] **Step 1: Add `<Toaster />` from `@/components/ui/sonner` in `main.jsx` wrapping/next to `<App />`.**

```jsx
import { Toaster } from '@/components/ui/sonner';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    <Toaster />
  </>
);
```

- [ ] **Step 2: Create `apps/web/src/pages/MaitreThibaultPage.jsx`** (fichier entier)

```jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ROOMS } from '@/data/rooms';
import {
  fetchMe,
  fetchSiteContent,
  loginManager,
  logoutManager,
  saveSiteContent,
} from '@/lib/siteContent';
import { cn } from '@/lib/utils';

const EMPTY_REVIEWS = [1, 2, 3].map((slot) => ({
  slot,
  name: '',
  city: '',
  text: '',
  stars: 5,
}));

const EMPTY_RECORDS = {
  directeur: [1, 2, 3].map((rank) => ({ rank, team: '', time: '00:00' })),
  vaisseau: [1, 2, 3].map((rank) => ({ rank, team: '', time: '00:00' })),
};

const ROOM_BLOCKS = [
  { slug: 'directeur', label: ROOMS.directeur.shortName },
  { slug: 'vaisseau', label: ROOMS.vaisseau.shortName },
];

function MaitreThibaultPage() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [reviews, setReviews] = useState(EMPTY_REVIEWS);
  const [records, setRecords] = useState(EMPTY_RECORDS);
  const [apiDown, setApiDown] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((me) => {
      if (cancelled) return;
      setSession(me);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    fetchSiteContent().then((data) => {
      if (cancelled) return;
      if (!data) {
        setApiDown(true);
        return;
      }
      setApiDown(false);
      setReviews(data.reviews);
      setRecords(data.records);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function onLogin(event) {
    event.preventDefault();
    setLoginError('');
    try {
      const me = await loginManager(email, password);
      setSession(me);
      setPassword('');
    } catch (err) {
      setLoginError(err.status === 429 ? err.message : 'Identifiants incorrects');
    }
  }

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        reviews: reviews.map((row, i) => ({
          slot: row.slot || i + 1,
          name: row.name,
          city: row.city,
          text: row.text,
          stars: row.stars,
        })),
        records,
      };
      const saved = await saveSiteContent(payload);
      setReviews(saved.reviews);
      setRecords(saved.records);
      toast.success('Enregistré.');
    } catch (err) {
      if (err.status === 401) {
        setSession(null);
        toast.error('Session expirée.');
      } else {
        toast.error(err.message || 'Enregistrement impossible, réessaie.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logoutManager();
    setSession(null);
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-12 text-foreground sm:px-6">
      <Helmet>
        <title>Bureau de Maître Thibault — Escape Occitanie</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto w-full max-w-3xl">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-primary">
          Accès restreint
        </p>
        <h1 className="mt-3 font-display text-3xl font-black tracking-wide sm:text-4xl">
          Bureau de Maître Thibault
        </h1>

        {checking ? (
          <p className="mt-8 text-muted-foreground">Ouverture du bureau…</p>
        ) : !session ? (
          <form onSubmit={onLogin} className="mt-10 max-w-md space-y-4">
            <p className="text-sm text-muted-foreground">
              Identifiez-vous pour modifier les avis et le hall of fame.
            </p>
            <div>
              <label htmlFor="mt-email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <Input
                id="mt-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="mt-password" className="mb-1.5 block text-sm font-medium">
                Mot de passe
              </label>
              <Input
                id="mt-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
            <Button type="submit" className="h-11 px-6">
              Entrer dans le bureau
            </Button>
          </form>
        ) : (
          <form onSubmit={onSave} className="mt-10 space-y-12">
            {apiDown ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                API injoignable
              </p>
            ) : null}

            <section>
              <h2 className="font-display text-2xl font-bold tracking-wide">Avis</h2>
              <div className="mt-6 space-y-8">
                {reviews.map((review, index) => (
                  <fieldset
                    key={review.slot || index}
                    className="space-y-3 border-l-2 border-primary/50 pl-5"
                  >
                    <legend className="font-display text-sm font-bold tracking-wider">
                      Avis {index + 1}
                    </legend>
                    <Input
                      placeholder="Nom"
                      value={review.name}
                      onChange={(e) => {
                        const next = [...reviews];
                        next[index] = { ...review, name: e.target.value };
                        setReviews(next);
                      }}
                    />
                    <Input
                      placeholder="Ville"
                      value={review.city}
                      onChange={(e) => {
                        const next = [...reviews];
                        next[index] = { ...review, city: e.target.value };
                        setReviews(next);
                      }}
                    />
                    <Textarea
                      placeholder="Témoignage"
                      rows={4}
                      value={review.text}
                      onChange={(e) => {
                        const next = [...reviews];
                        next[index] = { ...review, text: e.target.value };
                        setReviews(next);
                      }}
                    />
                    <div className="flex gap-1" role="group" aria-label="Note sur 5">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <button
                          key={s}
                          type="button"
                          className="text-primary"
                          aria-label={`${s + 1} étoiles`}
                          onClick={() => {
                            const next = [...reviews];
                            next[index] = { ...review, stars: s + 1 };
                            setReviews(next);
                          }}
                        >
                          <Star
                            className={cn(
                              'h-5 w-5',
                              s < review.stars ? 'fill-current' : 'text-muted-foreground'
                            )}
                            strokeWidth={s < review.stars ? 0 : 1.5}
                          />
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display text-2xl font-bold tracking-wide">Hall of fame</h2>
              <div className="mt-6 grid gap-8 md:grid-cols-2">
                {ROOM_BLOCKS.map((room) => (
                  <div key={room.slug} className="rounded-xl border border-border p-5">
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.15em]">
                      {room.label}
                    </h3>
                    <ol className="mt-4 space-y-3">
                      {(records[room.slug] || []).map((row, index) => (
                        <li key={row.rank || index} className="flex items-center gap-2">
                          <span className="w-6 font-display text-sm font-bold text-primary">
                            {index + 1}
                          </span>
                          <Input
                            placeholder="Équipe"
                            value={row.team}
                            onChange={(e) => {
                              const next = {
                                ...records,
                                [room.slug]: records[room.slug].map((item, i) =>
                                  i === index ? { ...item, team: e.target.value } : item
                                ),
                              };
                              setRecords(next);
                            }}
                          />
                          <Input
                            className="w-24 font-mono"
                            placeholder="MM:SS"
                            value={row.time}
                            onChange={(e) => {
                              const next = {
                                ...records,
                                [room.slug]: records[room.slug].map((item, i) =>
                                  i === index ? { ...item, time: e.target.value } : item
                                ),
                              };
                              setRecords(next);
                            }}
                          />
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving} className="h-11 px-6">
                Enregistrer
              </Button>
              <Button type="button" variant="outline" onClick={onLogout}>
                Se déconnecter
              </Button>
              <Link to="/" className="text-sm font-medium text-primary hover:underline">
                Voir le site
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default MaitreThibaultPage;
```

- [ ] **Step 3: Split App layouts**

```jsx
import { Route, Routes, BrowserRouter as Router, Link, Outlet } from 'react-router-dom';
import MaitreThibaultPage from './pages/MaitreThibaultPage';

function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="noise-overlay" aria-hidden="true" />
      <Routes>
        <Route path="/maitre-Thibault" element={<MaitreThibaultPage />} />
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/salles/convocation-chez-le-directeur"
            element={<RoomPage roomKey="directeur" />}
          />
          <Route
            path="/salles/la-malediction-du-vaisseau-fantome"
            element={<RoomPage roomKey="vaisseau" />}
          />
          <Route
            path="/reservation/convocation-chez-le-directeur"
            element={<BookingPage roomKey="directeur" />}
          />
          <Route
            path="/reservation/la-malediction-du-vaisseau-fantome"
            element={<BookingPage roomKey="vaisseau" />}
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}
```

Keep `NotFound` as it is. Remove unused `SiteHeader`/`SiteFooter` from the root of `App` (they live in `PublicLayout`).

- [ ] **Step 4: `robots.txt`** — after `Allow: /` add:

```
Disallow: /maitre-Thibault
Disallow: /api/
```

---

### Task 8: Vérification manuelle bout-en-bout

**Files:** none new

- [ ] **Step 1:** `npm run dev --prefix apps/web`
- [ ] **Step 2:** Login faux sur `/maitre-Thibault` → « Identifiants incorrects »
- [ ] **Step 3:** Login bon → formulaire prérempli (seed)
- [ ] **Step 4:** Changer un avis (étoiles à 4) + un temps record → Enregistrer → toast
- [ ] **Step 5:** Ouvrir `/` → nouvelles valeurs + 4 étoiles
- [ ] **Step 6:** Se déconnecter → POST `/api/content.php` sans cookie → 401
- [ ] **Step 7:** Header/footer absents sur `/maitre-Thibault` ; présents sur `/` ; pas de lien public vers le backoffice
- [ ] **Step 8:** Helmet `noindex` présent (View Source ou snapshot)
- [ ] **Step 9:** Restore seed via the backoffice so production-like data stays the current site copy

If a step fails, fix before marking the plan done.

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| PHP in `public/api/` + Vite proxy | 2, 5 |
| MySQL tables + seed rooms.js | 2 |
| 3 avis + stars 1–5 | 1, 4, 6, 7 |
| 6 records MM:SS | 1, 4, 7 |
| Email/password env + HMAC cookie | 3 |
| Rate limit 5/15 min | 1, 3 |
| GET public / POST auth | 2, 4 |
| HomePage fallback | 6 |
| `/maitre-Thibault` UI + no chrome | 7 |
| robots noindex | 7 |
| htaccess SPA + deny .env | 5 |
| DATABASE_URL password `?` | 1 |
| Session expired keeps form | 7 |
| Manual test list | 8 |
