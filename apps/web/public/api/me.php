<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

$env = mt_boot();
$session = mt_require_session($env);
$pdo = null;
try {
    $pdo = mt_pdo($env);
} catch (Throwable $ignored) {
    $pdo = null;
}
mt_json_out(200, mt_manager_session_payload($env, $session['email'], $pdo));
