<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$env = mt_boot();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    mt_json_out(405, ['error' => 'Méthode non autorisée.']);
}

$room = (string) ($_GET['room'] ?? '');
if (!in_array($room, MT_ROOM_SLUGS, true)) {
    mt_json_out(400, ['error' => 'Salle inconnue.']);
}

try {
    $pdo = mt_pdo($env);
} catch (Throwable $e) {
    mt_json_out(500, ['error' => 'Base de données injoignable.']);
}

$date = $_GET['date'] ?? null;
$from = $_GET['from'] ?? null;
$to = $_GET['to'] ?? null;

try {
    if ($date) {
        if (!mt_is_iso_date($date)) {
            mt_json_out(400, ['error' => 'Date invalide.']);
        }
        mt_json_out(200, [
            'date' => $date,
            'room' => $room,
            'slots' => mt_public_day_slots($pdo, $room, $date),
        ]);
    }

    if ($from && $to) {
        if (!mt_is_iso_date($from) || !mt_is_iso_date($to)) {
            mt_json_out(400, ['error' => 'Dates invalides.']);
        }
        $days = [];
        $cursor = new DateTimeImmutable($from);
        $last = new DateTimeImmutable($to);
        while ($cursor <= $last) {
            $iso = $cursor->format('Y-m-d');
            $slots = mt_public_day_slots($pdo, $room, $iso);
            $open = 0;
            foreach ($slots as $slot) {
                if ($slot['status'] === 'open') {
                    $open++;
                }
            }
            $days[$iso] = [
                'open' => $open,
                'total' => count($slots),
                'closed' => $slots === [],
            ];
            $cursor = $cursor->modify('+1 day');
        }
        mt_json_out(200, ['room' => $room, 'from' => $from, 'to' => $to, 'days' => $days]);
    }

    mt_json_out(400, ['error' => 'Paramètre date ou from/to requis.']);
} catch (Throwable $e) {
    mt_json_out(500, ['error' => 'Lecture impossible.']);
}
