<?php
declare(strict_types=1);

function mt_room_label(string $slug): string {
    return $slug === 'vaisseau' ? 'La malédiction du Vaisseau Fantôme' : 'Convocation chez le Directeur';
}

function mt_send_mail(array $env, string $to, string $subject, string $body, ?array $attachment = null): bool {
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $from = $env['SMTP_FROM'] ?? 'Escape Occitanie <reservations@escapeoccitanie.fr>';
    $encoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $reply = $env['MANAGER_EMAIL'] ?? 'escapeoccitanie@gmail.com';
    if ($attachment && !empty($attachment['content']) && !empty($attachment['filename'])) {
        $boundary = 'EscBound' . bin2hex(random_bytes(8));
        $filename = str_replace(['"', "\r", "\n"], '', $attachment['filename']);
        $mime = $attachment['mime'] ?? 'text/calendar; method=PUBLISH';
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'From: ' . $from,
            'Reply-To: ' . $reply,
            'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
        ]);
        $message = '--' . $boundary . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: 8bit\r\n\r\n"
            . $body . "\r\n"
            . '--' . $boundary . "\r\n"
            . 'Content-Type: ' . $mime . '; charset=UTF-8; name="' . $filename . '"' . "\r\n"
            . "Content-Transfer-Encoding: base64\r\n"
            . 'Content-Disposition: attachment; filename="' . $filename . '"' . "\r\n\r\n"
            . chunk_split(base64_encode($attachment['content']))
            . '--' . $boundary . "--\r\n";
        return @mail($to, $encoded, $message, $headers);
    }
    $headers = implode("\r\n", [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $from,
        'Reply-To: ' . $reply,
    ]);
    return @mail($to, $encoded, $body, $headers);
}

function mt_booking_customer_email(array $booking, string $kind = 'pending', array $env = []): string {
    $room = mt_room_label($booking['room_slug']);
    $time = $booking['time'] ?? mt_minutes_to_hhmm((int) $booking['start_minute']);
    $name = $booking['guest_name'];
    if ($kind === 'confirmed') {
        $intro = "Votre réservation est confirmée.";
    } else {
        $intro = "Nous avons bien reçu votre demande de réservation. Elle est en attente de confirmation par l'équipe.";
    }
    $body = "Bonjour {$name},\n\n"
        . "{$intro}\n\n"
        . "Salle : {$room}\n"
        . "Date : {$booking['booking_date']}\n"
        . "Heure : {$time}\n"
        . "Durée : 60 minutes\n"
        . "Joueurs : {$booking['players']}\n\n"
        . "Merci d'arriver 15 minutes avant le début de la session une fois la réservation confirmée.\n"
        . "Adresse : 23 Bd de Verdun, 12400 Saint-Affrique\n";
    if ($kind === 'confirmed' && $env !== []) {
        $links = mt_booking_calendar_links($env, $booking);
        $body .= "\nAjoutez l'événement à votre calendrier :\n"
            . "- Fichier joint (reservation.ics) ou téléchargement : {$links['ics']}\n"
            . "- Google Agenda : {$links['google']}\n";
    }
    $body .= "\nÀ très bientôt,\n"
        . "L'équipe Escape Occitanie\n";
    return $body;
}

function mt_booking_manager_email(array $booking): string {
    $room = mt_room_label($booking['room_slug']);
    $time = $booking['time'] ?? mt_minutes_to_hhmm((int) $booking['start_minute']);
    $status = $booking['status'] === 'confirmed' ? 'confirmée' : 'en attente de confirmation';
    return "Nouvelle réservation ({$status})\n\n"
        . "Salle : {$room}\n"
        . "Date : {$booking['booking_date']} à {$time}\n"
        . "Joueurs : {$booking['players']}\n"
        . "Nom : {$booking['guest_name']}\n"
        . "E-mail : {$booking['guest_email']}\n"
        . "Téléphone : {$booking['guest_phone']}\n";
}

function mt_booking_ics_attachment(array $booking): array {
    return [
        'filename' => 'reservation-escape-occitanie.ics',
        'mime' => 'text/calendar; method=PUBLISH',
        'content' => mt_booking_ics($booking),
    ];
}

function mt_send_booking_emails(array $env, array $booking, string $kind): bool {
    $subject = $kind === 'confirmed'
        ? 'Confirmation de réservation — Escape Occitanie'
        : 'Demande de réservation — Escape Occitanie';
    $attachment = $kind === 'confirmed' ? mt_booking_ics_attachment($booking) : null;
    $sent = mt_send_mail(
        $env,
        $booking['guest_email'],
        $subject,
        mt_booking_customer_email($booking, $kind, $env),
        $attachment
    );
    $manager = $env['MANAGER_EMAIL'] ?? '';
    if ($kind === 'pending' && $manager !== '') {
        mt_send_mail($env, $manager, 'Nouvelle demande de réservation — Escape Occitanie', mt_booking_manager_email($booking));
    }
    return $sent;
}
