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
