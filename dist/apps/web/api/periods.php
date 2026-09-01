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

function mt_require_period_input(array $body): array {
    $date = trim((string) ($body['date'] ?? ''));
    $start = mt_hhmm_to_minutes((string) ($body['start'] ?? ''));
    $end = mt_hhmm_to_minutes((string) ($body['end'] ?? ''));
    if (!mt_is_iso_date($date) || $start === null || $end === null) {
        mt_json_out(400, ['error' => 'Date et horaires HH:MM obligatoires.']);
    }
    $occupancy = mt_occupancy_minutes();
    $slot = mt_slot_minutes();
    if ($end - $start < $occupancy) {
        mt_json_out(400, ['error' => "La plage doit durer au moins {$occupancy} minutes."]);
    }
    if ($slot < 1 || $start % $slot !== 0 || $end % $slot !== 0) {
        mt_json_out(400, ['error' => "Les horaires doivent être alignés sur {$slot} minutes."]);
    }
    return ['date' => $date, 'start' => $start, 'end' => $end];
}

if ($method === 'POST') {
    mt_require_session($env);
    mt_ensure_schema($pdo);
    $action = (string) ($_GET['action'] ?? '');
    if ($action === 'copy') {
        $body = mt_read_json();
        $sourceId = (int) ($body['sourceId'] ?? 0);
        $dates = $body['dates'] ?? null;
        $overwrite = (bool) ($body['overwrite'] ?? false);
        if ($sourceId < 1 || !is_array($dates)) {
            mt_json_out(400, ['error' => 'Source et dates obligatoires.']);
        }
        $result = mt_copy_period($pdo, $sourceId, $dates, $overwrite);
        if (($result['error'] ?? '') === 'not_found') {
            mt_json_out(404, ['error' => 'Plage introuvable.']);
        }
        if (($result['error'] ?? '') === 'invalid') {
            mt_json_out(400, ['error' => 'Dates invalides.']);
        }
        if (isset($result['dates'])) {
            mt_json_out(409, [
                'error' => 'Certains jours ont déjà une plage.',
                'dates' => $result['dates'],
            ]);
        }
        mt_json_out(200, ['ok' => true, 'copied' => (int) $result['copied']]);
    }
    $input = mt_require_period_input(mt_read_json());
    try {
        mt_json_out(200, mt_add_period($pdo, $input['date'], $input['start'], $input['end']));
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Enregistrement impossible, réessaie.']);
    }
}

if ($method === 'PATCH') {
    mt_require_session($env);
    mt_ensure_schema($pdo);
    $id = (int) ($_GET['id'] ?? 0);
    if ($id < 1) {
        mt_json_out(400, ['error' => 'Identifiant manquant.']);
    }
    $input = mt_require_period_input(mt_read_json());
    $updated = mt_update_period($pdo, $id, $input['date'], $input['start'], $input['end']);
    if ($updated === null) {
        mt_json_out(404, ['error' => 'Plage introuvable.']);
    }
    mt_json_out(200, $updated);
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
