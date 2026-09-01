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

function mt_rate_limit_hit(string $ip, int $max = 5, int $window = 900, bool $record = true): bool {
    $file = mt_rate_limit_path($ip);
    $now = time();
    $fh = fopen($file, 'c+');
    if ($fh === false) {
        return false;
    }
    try {
        if (!flock($fh, LOCK_EX)) {
            return false;
        }
        $raw = stream_get_contents($fh);
        $hits = [];
        if ($raw !== false && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $hits = $decoded;
            }
        }
        $hits = array_values(array_filter($hits, fn($t) => is_int($t) && $t > $now - $window));
        $blocked = count($hits) >= $max;
        if ($record && !$blocked) {
            $hits[] = $now;
        }
        rewind($fh);
        ftruncate($fh, 0);
        fwrite($fh, json_encode($hits));
        fflush($fh);
        flock($fh, LOCK_UN);
    } finally {
        fclose($fh);
    }
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
