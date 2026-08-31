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
