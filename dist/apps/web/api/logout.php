<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

mt_boot();
mt_clear_auth_cookie();
mt_json_out(200, ['ok' => true]);
