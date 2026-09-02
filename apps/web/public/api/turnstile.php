<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$env = mt_boot();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

$enabled = mt_turnstile_configured($env);
mt_json_out(200, [
    'enabled' => $enabled,
    'siteKey' => $enabled ? trim((string) ($env['TURNSTILE_SITE_KEY'] ?? '')) : '',
]);
