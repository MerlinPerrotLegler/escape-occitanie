<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function mt_avis_page_out(int $status, string $html): void {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo $html;
    exit;
}

$env = mt_boot();
$id = (int) ($_GET['b'] ?? $_GET['id'] ?? 0);
$token = trim((string) ($_GET['t'] ?? ''));
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || $id < 1 || $token === '') {
    mt_avis_page_out(400, mt_review_page_html([], 'invalid'));
}

try {
    $pdo = mt_pdo($env);
    $booking = mt_get_booking($pdo, $id, $env);
} catch (Throwable $e) {
    mt_avis_page_out(500, mt_review_page_html([], 'invalid'));
}

if (
    !$booking
    || ($booking['status'] ?? '') !== 'confirmed'
    || !mt_review_token_ok($env, $id, (string) $booking['guest_email'], $token)
) {
    mt_avis_page_out(404, mt_review_page_html($booking ?: [], 'invalid'));
}

mt_avis_page_out(200, mt_review_page_html($booking, 'ok'));
