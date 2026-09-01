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
        mt_json_out(200, ['settings' => mt_get_booking_settings($pdo)]);
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Lecture impossible.']);
    }
}

if ($method === 'PATCH' || $method === 'POST') {
    mt_require_session($env);
    try {
        mt_json_out(200, ['settings' => mt_save_booking_settings($pdo, mt_read_json())]);
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Enregistrement impossible, réessaie.']);
    }
}

mt_json_out(405, ['error' => 'Méthode non autorisée.']);
