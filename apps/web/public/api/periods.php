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
    $from = $_GET['from'] ?? null;
    $to = $_GET['to'] ?? null;
    if ($from !== null && $to !== null) {
        if (!mt_is_iso_date($from) || !mt_is_iso_date($to)) {
            mt_json_out(400, ['error' => 'Dates invalides.']);
        }
        mt_json_out(200, ['periods' => mt_list_periods($pdo, $from, $to)]);
    }
    mt_require_session($env);
    mt_json_out(200, ['periods' => mt_list_periods($pdo)]);
}

if ($method === 'POST') {
    mt_require_session($env);
    $body = mt_read_json();
    $date = trim((string) ($body['date'] ?? ''));
    $start = mt_hhmm_to_minutes((string) ($body['start'] ?? ''));
    $end = mt_hhmm_to_minutes((string) ($body['end'] ?? ''));
    if (!mt_is_iso_date($date) || $start === null || $end === null) {
        mt_json_out(400, ['error' => 'Date et horaires HH:MM obligatoires.']);
    }
    if ($end - $start < MT_GAME_MINUTES) {
        mt_json_out(400, ['error' => 'La plage doit durer au moins 60 minutes (2 créneaux).']);
    }
    if ($start % MT_SLOT_MINUTES !== 0 || $end % MT_SLOT_MINUTES !== 0) {
        mt_json_out(400, ['error' => 'Les horaires doivent être alignés sur 30 minutes.']);
    }
    try {
        mt_json_out(200, mt_add_period($pdo, $date, $start, $end));
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Enregistrement impossible, réessaie.']);
    }
}

if ($method === 'DELETE') {
    mt_require_session($env);
    $id = (int) ($_GET['id'] ?? 0);
    if ($id < 1) {
        mt_json_out(400, ['error' => 'Identifiant manquant.']);
    }
    if (!mt_delete_period($pdo, $id)) {
        mt_json_out(404, ['error' => 'Plage introuvable.']);
    }
    mt_json_out(200, ['ok' => true]);
}

mt_json_out(405, ['error' => 'Méthode non autorisée.']);
