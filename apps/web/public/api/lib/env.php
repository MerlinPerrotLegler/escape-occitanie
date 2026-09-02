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
    $layers = [];
    $repoEnv = null;
    for ($i = 0; $i < 8; $i++) {
        $layer = mt_parse_env_file($dir . '/.env');
        $layers[] = $layer;
        if ($repoEnv === null && (is_dir($dir . '/.git') || is_file($dir . '/.git'))) {
            $repoEnv = $layer;
        }
        $parent = dirname($dir);
        if ($parent === $dir) {
            break;
        }
        $dir = $parent;
    }
    $repoEnv = $repoEnv ?? [];
    $merged = [];
    foreach ($layers as $layer) {
        $merged = array_merge($layer, $merged);
    }
    foreach (['MANAGER_EMAIL', 'MANAGER_PASSWORD', 'MANAGER_NAME', 'AUTH_SECRET'] as $key) {
        if (($repoEnv[$key] ?? '') !== '') {
            $merged[$key] = $repoEnv[$key];
        }
    }
    foreach (['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_PORT', 'DATABASE_URL', 'MANAGER_EMAIL', 'MANAGER_PASSWORD', 'MANAGER_NAME', 'AUTH_SECRET', 'SMTP_FROM', 'SMTP_HOST', 'HOSTINGER_EMAIL_MCP_TOKEN', 'HOSTINGER_MAIL_MAILBOX_ID'] as $key) {
        $g = getenv($key);
        if ($g !== false && $g !== '') {
            $merged[$key] = $g;
        }
    }
    return $merged;
}
