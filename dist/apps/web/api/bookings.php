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
    mt_require_session($env);
    $filter = (string) ($_GET['filtre'] ?? $_GET['filter'] ?? 'aujourdhui');
    $page = (int) ($_GET['page'] ?? 1);
    $focus = isset($_GET['focus']) ? (int) $_GET['focus'] : null;
    mt_json_out(200, mt_list_bookings_page($pdo, $filter, $page, $focus > 0 ? $focus : null));
}

if ($method === 'POST' && isset($_GET['id']) && (($_GET['action'] ?? '') === 'mail' || ($_GET['action'] ?? '') === 'confirm')) {
    mt_require_session($env);
    $id = (int) $_GET['id'];
    $action = (string) $_GET['action'];
    if ($action === 'confirm') {
        try {
            $booking = mt_confirm_booking($pdo, $id);
            if (!$booking) {
                mt_json_out(404, ['error' => 'Réservation introuvable ou déjà traitée.']);
            }
            $emailSent = false;
            try {
                $emailSent = mt_send_booking_emails($env, $booking, 'confirmed');
            } catch (Throwable $ignored) {
                $emailSent = false;
            }
            mt_json_out(200, ['booking' => $booking, 'emailSent' => $emailSent]);
        } catch (RuntimeException $e) {
            mt_json_out(409, ['error' => $e->getMessage(), 'warning' => true]);
        }
    }
    $booking = mt_get_booking($pdo, $id);
    if (!$booking || $booking['status'] === 'cancelled') {
        mt_json_out(404, ['error' => 'Réservation introuvable.']);
    }
    $kind = $booking['status'] === 'confirmed' ? 'confirmed' : 'pending';
    $emailSent = false;
    try {
        $attachment = $kind === 'confirmed' ? mt_booking_ics_attachment($booking) : null;
        $emailSent = mt_send_mail(
            $env,
            $booking['guest_email'],
            $kind === 'confirmed' ? 'Confirmation de réservation — Escape Occitanie' : 'Demande de réservation — Escape Occitanie',
            mt_booking_customer_email($booking, $kind, $env),
            $attachment
        );
    } catch (Throwable $ignored) {
        $emailSent = false;
    }
    mt_json_out(200, ['ok' => true, 'emailSent' => $emailSent, 'booking' => $booking]);
}

if ($method === 'PATCH') {
    mt_require_session($env);
    $id = (int) ($_GET['id'] ?? 0);
    if ($id < 1) {
        mt_json_out(400, ['error' => 'Identifiant manquant.']);
    }
    $body = mt_read_json();
    try {
        $name = isset($body['name']) ? trim((string) $body['name']) : null;
        $email = isset($body['email']) ? trim((string) $body['email']) : null;
        $phone = isset($body['phone']) ? trim((string) $body['phone']) : null;
        $players = array_key_exists('players', $body) ? (int) $body['players'] : null;
        if ($name !== null) {
            $checked = mt_validate_guest_name($name);
            if (!$checked['ok']) {
                mt_json_out(400, ['error' => $checked['error']]);
            }
            $name = $checked['value'];
        }
        if ($email !== null) {
            $checked = mt_validate_guest_email($email);
            if (!$checked['ok']) {
                mt_json_out(400, ['error' => $checked['error']]);
            }
            $email = $checked['value'];
        }
        if ($phone !== null) {
            $checked = mt_validate_guest_phone($phone);
            if (!$checked['ok']) {
                mt_json_out(400, ['error' => $checked['error']]);
            }
            $phone = $checked['value'];
        }
        if ($players !== null && ($players < 3 || $players > 6)) {
            mt_json_out(400, ['error' => 'Entre 3 et 6 joueurs.']);
        }
        $fields = [];
        if ($name !== null) {
            $fields['guest_name'] = $name;
        }
        if ($email !== null) {
            $fields['guest_email'] = $email;
        }
        if ($phone !== null) {
            $fields['guest_phone'] = $phone;
        }
        if ($players !== null) {
            $fields['players'] = $players;
        }
        if (isset($body['date'], $body['time'])) {
            $fields['date'] = trim((string) $body['date']);
            $fields['time'] = trim((string) $body['time']);
        }
        $booking = mt_update_booking($pdo, $id, $fields);
        if (!$booking) {
            mt_json_out(404, ['error' => 'Réservation introuvable.']);
        }
        mt_json_out(200, ['booking' => $booking]);
    } catch (InvalidArgumentException $e) {
        mt_json_out(400, ['error' => $e->getMessage()]);
    } catch (RuntimeException $e) {
        mt_json_out(409, ['error' => $e->getMessage(), 'warning' => true]);
    } catch (Throwable $e) {
        mt_json_out(500, ['error' => 'Mise à jour impossible, réessaie.']);
    }
}

if ($method === 'POST') {
    $body = mt_read_json();
    $room = (string) ($body['room'] ?? '');
    $date = trim((string) ($body['date'] ?? ''));
    $time = trim((string) ($body['time'] ?? ''));
    $name = trim((string) ($body['name'] ?? ''));
    $email = trim((string) ($body['email'] ?? ''));
    $phone = trim((string) ($body['phone'] ?? ''));
    $players = (int) ($body['players'] ?? 0);
    $start = mt_hhmm_to_minutes($time);

    mt_ensure_schema($pdo);
    if (!in_array($room, MT_ROOM_SLUGS, true)) {
        mt_json_out(400, ['error' => 'Salle inconnue.']);
    }
    if (!mt_is_iso_date($date) || $start === null || !mt_is_slot_aligned($start)) {
        mt_json_out(400, ['error' => 'Date ou horaire invalide (créneaux de ' . mt_slot_minutes() . ' min).']);
    }
    if ($date < mt_today_paris()) {
        mt_json_out(400, ['error' => 'Impossible de réserver une date passée.']);
    }
    $checkedName = mt_validate_guest_name($name);
    if (!$checkedName['ok']) {
        mt_json_out(400, ['error' => $checkedName['error']]);
    }
    $name = $checkedName['value'];
    $checkedEmail = mt_validate_guest_email($email);
    if (!$checkedEmail['ok']) {
        mt_json_out(400, ['error' => $checkedEmail['error']]);
    }
    $email = $checkedEmail['value'];
    $checkedPhone = mt_validate_guest_phone($phone);
    if (!$checkedPhone['ok']) {
        mt_json_out(400, ['error' => $checkedPhone['error']]);
    }
    $phone = $checkedPhone['value'];
    if ($players < 3 || $players > 6) {
        mt_json_out(400, ['error' => 'Entre 3 et 6 joueurs.']);
    }

    $booking = null;
    try {
        $pdo->query("SELECT GET_LOCK('escape-booking', 10)")->fetch();
        $pdo->beginTransaction();
        $open = mt_find_open_game_slot($pdo, $room, $date, $start);
        if (!$open) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            mt_json_out(409, ['error' => 'Ce créneau n’est plus disponible.']);
        }
        $booking = mt_create_booking($pdo, [
            'room_slug' => $room,
            'booking_date' => $date,
            'start_minute' => $start,
            'guest_name' => $name,
            'guest_email' => $email,
            'guest_phone' => $phone,
            'players' => $players,
        ]);
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        mt_json_out(500, ['error' => 'Réservation impossible, réessaie.']);
    } finally {
        try {
            $pdo->query("SELECT RELEASE_LOCK('escape-booking')")->fetch();
        } catch (Throwable $ignored) {
        }
    }

    $emailSent = false;
    try {
        $kind = $booking['status'] === 'confirmed' ? 'confirmed' : 'pending';
        $emailSent = mt_send_booking_emails($env, $booking, $kind, $kind === 'confirmed');
    } catch (Throwable $ignored) {
        $emailSent = false;
    }
    mt_json_out(201, ['booking' => $booking, 'emailSent' => $emailSent]);
}

if ($method === 'DELETE') {
    mt_require_session($env);
    $id = (int) ($_GET['id'] ?? 0);
    if ($id < 1) {
        mt_json_out(400, ['error' => 'Identifiant manquant.']);
    }
    if (!mt_cancel_booking($pdo, $id)) {
        mt_json_out(404, ['error' => 'Réservation introuvable.']);
    }
    mt_json_out(200, ['ok' => true]);
}

mt_json_out(405, ['error' => 'Méthode non autorisée.']);
