<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function mt_confirm_page_out(int $status, string $html): void {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo $html;
    exit;
}

$env = mt_boot();
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$id = (int) ($_POST['b'] ?? $_GET['b'] ?? $_GET['id'] ?? 0);
$token = trim((string) ($_POST['t'] ?? $_GET['t'] ?? ''));

if ($id < 1 || $token === '') {
    mt_confirm_page_out(400, mt_manager_confirm_page_html([], 'invalid'));
}

try {
    $pdo = mt_pdo($env);
    $booking = mt_get_booking($pdo, $id);
} catch (Throwable $e) {
    mt_confirm_page_out(500, mt_manager_confirm_page_html([], 'invalid', [], 'Confirmation indisponible pour le moment.'));
}

$links = mt_manager_booking_links($env, $booking ?: ['id' => $id, 'guest_email' => '']);
if (
    !$booking
    || $booking['status'] === 'cancelled'
    || !mt_manager_confirm_token_ok($env, $id, (string) $booking['guest_email'], $token)
) {
    mt_confirm_page_out(404, mt_manager_confirm_page_html($booking ?: [], 'invalid', $links));
}

if ($booking['status'] === 'confirmed') {
    mt_confirm_page_out(200, mt_manager_confirm_page_html($booking, 'already', $links));
}

if ($method === 'POST') {
    try {
        $confirmed = mt_confirm_booking($pdo, $id);
        if (!$confirmed) {
            mt_confirm_page_out(404, mt_manager_confirm_page_html($booking, 'invalid', $links));
        }
        try {
            mt_send_booking_emails($env, $confirmed, 'confirmed');
        } catch (Throwable $ignored) {
        }
        mt_confirm_page_out(200, mt_manager_confirm_page_html($confirmed, 'confirmed', $links));
    } catch (RuntimeException $e) {
        mt_confirm_page_out(409, mt_manager_confirm_page_html($booking, 'conflict', $links, $e->getMessage()));
    } catch (Throwable $e) {
        mt_confirm_page_out(500, mt_manager_confirm_page_html($booking, 'conflict', $links, 'Confirmation impossible, réessaie.'));
    }
}

mt_confirm_page_out(200, mt_manager_confirm_page_html($booking, 'form', $links));
