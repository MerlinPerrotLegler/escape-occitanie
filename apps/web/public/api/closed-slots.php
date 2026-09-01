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

mt_require_session($env);

if ($method === 'GET') {
    $date = trim((string) ($_GET['date'] ?? ''));
    if (!mt_is_iso_date($date)) {
        mt_json_out(400, ['error' => 'Date invalide.']);
    }
    $rooms = [];
    foreach (MT_ROOM_SLUGS as $slug) {
        $rooms[$slug] = mt_admin_day_slots($pdo, $slug, $date);
    }
    mt_json_out(200, ['date' => $date, 'rooms' => $rooms]);
}

if ($method === 'POST') {
    $body = mt_read_json();
    $room = (string) ($body['room'] ?? '');
    $date = trim((string) ($body['date'] ?? ''));
    $start = mt_hhmm_to_minutes((string) ($body['time'] ?? ''));
    if ($start === null) {
        mt_json_out(400, ['error' => 'Date et horaire HH:MM obligatoires.']);
    }
    try {
        mt_json_out(200, mt_close_slot($pdo, $room, $date, $start));
    } catch (InvalidArgumentException $e) {
        mt_json_out(400, ['error' => $e->getMessage()]);
    } catch (RuntimeException $e) {
        mt_json_out(409, ['error' => $e->getMessage(), 'warning' => true]);
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Fermeture impossible, réessaie.']);
    }
}

if ($method === 'DELETE') {
    $room = (string) ($_GET['room'] ?? '');
    $date = trim((string) ($_GET['date'] ?? ''));
    $start = mt_hhmm_to_minutes((string) ($_GET['time'] ?? ''));
    if (!in_array($room, MT_ROOM_SLUGS, true) || !mt_is_iso_date($date) || $start === null) {
        mt_json_out(400, ['error' => 'Salle, date et horaire obligatoires.']);
    }
    if (!mt_open_slot($pdo, $room, $date, $start)) {
        mt_json_out(404, ['error' => 'Créneau fermé introuvable.']);
    }
    mt_json_out(200, ['ok' => true]);
}

mt_json_out(405, ['error' => 'Méthode non autorisée.']);
