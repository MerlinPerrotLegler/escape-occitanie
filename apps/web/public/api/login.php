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

$emailOk = hash_equals(hash('sha256', 'e:'.$expectedEmail), hash('sha256', 'e:'.$email));
$passOk = hash_equals(hash('sha256', 'p:'.$expectedPass), hash('sha256', 'p:'.$password));
$configOk = $expectedEmail !== '' && $expectedPass !== '' && $secret !== '';
$ok = $configOk && $emailOk && $passOk;

if (!$ok) {
    mt_json_out(401, ['error' => 'Identifiants incorrects']);
}

$ttl = 604800;
mt_set_auth_cookie(mt_issue_cookie($email, $secret, $ttl), $ttl);
mt_json_out(200, [
    'email' => $email,
    'name' => (string) ($env['MANAGER_NAME'] ?? 'Direction'),
]);
