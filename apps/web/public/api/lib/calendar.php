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

function mt_booking_datetime(array $booking): array {
    $time = $booking['time'] ?? mt_minutes_to_hhmm((int) $booking['start_minute']);
    $tz = new DateTimeZone('Europe/Paris');
    $start = DateTimeImmutable::createFromFormat('Y-m-d H:i', $booking['booking_date'] . ' ' . $time, $tz);
    if (!$start) {
        throw new RuntimeException('Date de réservation invalide.');
    }
    $end = $start->modify('+' . MT_GAME_MINUTES . ' minutes');
    return [$start, $end];
}

function mt_ics_escape(string $text): string {
    return str_replace(["\\", ";", ",", "\n", "\r"], ["\\\\", "\\;", "\\,", '\\n', ''], $text);
}

function mt_booking_ics(array $booking): string {
    [$start, $end] = mt_booking_datetime($booking);
    $utc = new DateTimeZone('UTC');
    $stamp = (new DateTimeImmutable('now', $utc))->format('Ymd\THis\Z');
    $dtStart = $start->setTimezone($utc)->format('Ymd\THis\Z');
    $dtEnd = $end->setTimezone($utc)->format('Ymd\THis\Z');
    $room = mt_room_label($booking['room_slug']);
    $uid = 'booking-' . (int) $booking['id'] . '@escapeoccitanie.fr';
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
        . "METHOD:PUBLISH\r\n"
        . "BEGIN:VEVENT\r\n"
        . "UID:{$uid}\r\n"
        . "DTSTAMP:{$stamp}\r\n"
        . "DTSTART:{$dtStart}\r\n"
        . "DTEND:{$dtEnd}\r\n"
        . "SUMMARY:{$summary}\r\n"
        . "DESCRIPTION:{$desc}\r\n"
        . "LOCATION:{$location}\r\n"
        . "END:VEVENT\r\n"
        . "END:VCALENDAR\r\n";
}

function mt_booking_calendar_links(array $env, array $booking): array {
    [$start, $end] = mt_booking_datetime($booking);
    $utc = new DateTimeZone('UTC');
    $dates = $start->setTimezone($utc)->format('Ymd\THis\Z') . '/' . $end->setTimezone($utc)->format('Ymd\THis\Z');
    $room = mt_room_label($booking['room_slug']);
    $text = 'Escape Occitanie — ' . $room;
    $details = "Salle : {$room}. {$booking['players']} joueurs. Merci d'arriver 15 minutes avant le début.";
    $location = '23 Bd de Verdun, 12400 Saint-Affrique, France';
    $google = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
        . '&text=' . rawurlencode($text)
        . '&dates=' . $dates
        . '&details=' . rawurlencode($details)
        . '&location=' . rawurlencode($location);
    $token = mt_calendar_token($env, (int) $booking['id'], $booking['guest_email']);
    $ics = mt_public_base($env) . '/api/calendar.php?b=' . (int) $booking['id'] . '&t=' . rawurlencode($token);
    return ['ics' => $ics, 'google' => $google];
}
