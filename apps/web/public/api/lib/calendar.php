<?php
declare(strict_types=1);

function mt_public_base(array $env): string {
    $url = rtrim((string) ($env['AUTH_URL'] ?? ''), '/');
    if ($url !== '') {
        return $url;
    }
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $host = $_SERVER['HTTP_HOST'] ?? 'escapeoccitanie.fr';
    return ($https ? 'https://' : 'http://') . $host;
}

function mt_calendar_token(array $env, int $bookingId, string $email): string {
    $secret = (string) ($env['AUTH_SECRET'] ?? '');
    return substr(hash_hmac('sha256', $bookingId . '|' . strtolower($email), $secret), 0, 20);
}

function mt_calendar_token_ok(array $env, int $bookingId, string $email, string $token): bool {
    if ($token === '' || $bookingId < 1) {
        return false;
    }
    $expected = mt_calendar_token($env, $bookingId, $email);
    return hash_equals($expected, $token);
}

function mt_manager_confirm_token(array $env, int $bookingId, string $email): string {
    $secret = (string) ($env['AUTH_SECRET'] ?? '');
    return substr(hash_hmac('sha256', 'confirm|' . $bookingId . '|' . strtolower($email), $secret), 0, 24);
}

function mt_manager_confirm_token_ok(array $env, int $bookingId, string $email, string $token): bool {
    if ($token === '' || $bookingId < 1) {
        return false;
    }
    $expected = mt_manager_confirm_token($env, $bookingId, $email);
    return hash_equals($expected, $token);
}

function mt_review_token(array $env, int $bookingId, string $email = ''): string {
    $secret = (string) ($env['AUTH_SECRET'] ?? '');
    return substr(hash_hmac('sha256', 'avis|' . $bookingId, $secret), 0, 20);
}

function mt_review_legacy_token(array $env, int $bookingId, string $email): string {
    $secret = (string) ($env['AUTH_SECRET'] ?? '');
    return substr(hash_hmac('sha256', 'avis|' . $bookingId . '|' . strtolower($email), $secret), 0, 20);
}

function mt_review_token_ok(array $env, int $bookingId, string $email, string $token): bool {
    if ($token === '' || $bookingId < 1) {
        return false;
    }
    $expected = mt_review_token($env, $bookingId);
    if (hash_equals($expected, $token)) {
        return true;
    }
    $legacy = mt_review_legacy_token($env, $bookingId, $email);
    return $legacy !== '' && hash_equals($legacy, $token);
}

function mt_review_page_url(array $env, array $booking): string {
    $id = (int) ($booking['id'] ?? 0);
    $token = $id > 0 ? mt_review_token($env, $id) : '';
    return mt_public_base($env) . '/api/avis.php?b=' . $id . '&t=' . rawurlencode($token);
}

function mt_manager_booking_links(array $env, array $booking): array {
    $id = (int) ($booking['id'] ?? 0);
    $email = (string) ($booking['guest_email'] ?? '');
    $token = $id > 0 ? mt_manager_confirm_token($env, $id, $email) : '';
    $base = mt_public_base($env);
    return [
        'voir' => $base . '/maitre#reservations/' . $id . '?filtre=toutes&page=1',
        'confirmer' => $base . '/api/confirm-booking.php?b=' . $id . '&t=' . rawurlencode($token),
        'token' => $token,
    ];
}

function mt_booking_datetime(array $booking): array {
    $time = $booking['time'] ?? mt_minutes_to_hhmm((int) $booking['start_minute']);
    $tz = new DateTimeZone('Europe/Paris');
    $start = DateTimeImmutable::createFromFormat('Y-m-d H:i', $booking['booking_date'] . ' ' . $time, $tz);
    if (!$start) {
        throw new RuntimeException('Date de réservation invalide.');
    }
    $duration = mt_occupancy_duration($booking);
    $end = $start->modify('+' . $duration . ' minutes');
    return [$start, $end];
}

function mt_ics_escape(string $text): string {
    return str_replace(["\\", ";", ",", "\n", "\r"], ["\\\\", "\\;", "\\,", '\\n', ''], $text);
}

function mt_should_refresh_guest_calendar(array $before, array $after): bool {
    if (($after['status'] ?? '') !== 'confirmed') {
        return false;
    }
    return (string) ($before['booking_date'] ?? '') !== (string) ($after['booking_date'] ?? '')
        || (int) ($before['start_minute'] ?? -1) !== (int) ($after['start_minute'] ?? -1);
}

function mt_booking_ics(array $booking, array $env = []): string {
    [$start, $end] = mt_booking_datetime($booking);
    $utc = new DateTimeZone('UTC');
    $stamp = (new DateTimeImmutable('now', $utc))->format('Ymd\THis\Z');
    $dtStart = $start->setTimezone($utc)->format('Ymd\THis\Z');
    $dtEnd = $end->setTimezone($utc)->format('Ymd\THis\Z');
    $room = mt_room_label($booking['room_slug']);
    $uid = 'booking-' . (int) $booking['id'] . '@escapeoccitanie.fr';
    $sequence = max(0, (int) ($booking['ics_sequence'] ?? 0));
    $from = function_exists('mt_mail_identity')
        ? mt_mail_identity((string) ($env['SMTP_FROM'] ?? 'Escape Occitanie <contact@escapeoccitanie.fr>'))
        : ['name' => 'Escape Occitanie', 'email' => 'contact@escapeoccitanie.fr'];
    $orgEmail = $from['email'] !== '' ? $from['email'] : 'contact@escapeoccitanie.fr';
    $orgName = mt_ics_escape($from['name'] !== '' ? $from['name'] : 'Escape Occitanie');
    $attendeeName = mt_ics_escape((string) ($booking['guest_name'] ?? ''));
    $attendeeEmail = (string) ($booking['guest_email'] ?? '');
    $summary = mt_ics_escape('Escape Occitanie — ' . $room);
    $desc = mt_ics_escape(
        "Salle : {$room}\n"
        . "Joueurs : {$booking['players']}\n"
        . "Arrivez 15 minutes avant le début.\n"
        . "23 Bd de Verdun, 12400 Saint-Affrique"
    );
    $location = mt_ics_escape('23 Bd de Verdun, 12400 Saint-Affrique, France');
    return "BEGIN:VCALENDAR\r\n"
        . "VERSION:2.0\r\n"
        . "PRODID:-//Escape Occitanie//Reservation//FR\r\n"
        . "CALSCALE:GREGORIAN\r\n"
        . "METHOD:REQUEST\r\n"
        . "BEGIN:VEVENT\r\n"
        . "UID:{$uid}\r\n"
        . "SEQUENCE:{$sequence}\r\n"
        . "DTSTAMP:{$stamp}\r\n"
        . "LAST-MODIFIED:{$stamp}\r\n"
        . "STATUS:CONFIRMED\r\n"
        . "ORGANIZER;CN={$orgName}:mailto:{$orgEmail}\r\n"
        . "ATTENDEE;CN={$attendeeName};RSVP=TRUE;PARTSTAT=ACCEPTED;ROLE=REQ-PARTICIPANT:mailto:{$attendeeEmail}\r\n"
        . "DTSTART:{$dtStart}\r\n"
        . "DTEND:{$dtEnd}\r\n"
        . "SUMMARY:{$summary}\r\n"
        . "DESCRIPTION:{$desc}\r\n"
        . "LOCATION:{$location}\r\n"
        . "END:VEVENT\r\n"
        . "END:VCALENDAR\r\n";
}

function mt_booking_calendar_links(array $env, array $booking): array {
    $token = mt_calendar_token($env, (int) $booking['id'], $booking['guest_email']);
    $ics = mt_public_base($env) . '/api/calendar.php?b=' . (int) $booking['id'] . '&t=' . rawurlencode($token);
    return ['ics' => $ics];
}
