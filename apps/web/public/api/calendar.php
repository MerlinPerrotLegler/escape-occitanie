<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

$env = mt_boot();
$id = (int) ($_GET['b'] ?? $_GET['id'] ?? 0);
$token = (string) ($_GET['t'] ?? '');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || $id < 1 || $token === '') {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Lien invalide.';
    exit;
}

try {
    $pdo = mt_pdo($env);
    $booking = mt_get_booking($pdo, $id);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Calendrier indisponible.';
    exit;
}

if (
    !$booking
    || $booking['status'] !== 'confirmed'
    || !mt_calendar_token_ok($env, $id, $booking['guest_email'], $token)
) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Événement introuvable.';
    exit;
}

$ics = mt_booking_ics($booking, $env);
header('Content-Type: text/calendar; method=REQUEST; charset=utf-8');
header('Content-Disposition: attachment; filename="reservation-escape-occitanie.ics"');
header('Cache-Control: private, no-store');
echo $ics;
