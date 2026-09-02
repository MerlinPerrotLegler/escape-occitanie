<?php
declare(strict_types=1);

function mt_site_copy_path(): string {
    return dirname(__DIR__) . '/site-copy.json';
}

function mt_load_site_copy(): ?array {
    static $loaded = false;
    static $cache = null;
    if ($loaded) {
        return $cache;
    }
    $loaded = true;
    $path = mt_site_copy_path();
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    $data = json_decode((string) $raw, true);
    $cache = is_array($data) ? $data : null;
    return $cache;
}

function mt_fill_copy(string $template, array $vars): string {
    return (string) preg_replace_callback('/\{([a-z0-9_-]+)\}/i', static function (array $match) use ($vars): string {
        return array_key_exists($match[1], $vars) ? (string) $vars[$match[1]] : $match[0];
    }, $template);
}

function mt_room_label(string $slug): string {
    $copy = mt_load_site_copy();
    $name = $copy['rooms'][$slug]['name'] ?? null;
    if (is_string($name) && $name !== '') {
        return $name;
    }
    return $slug === 'vaisseau' ? 'La malédiction du Vaisseau Fantôme' : 'Convocation chez le Directeur';
}

function mt_mail_public_origin(?array $copy = null): string {
    $site = rtrim((string) (($copy ?? mt_load_site_copy())['contact']['website'] ?? ''), '/');
    if ($site !== '') {
        return $site;
    }
    return 'https://escapeoccitanie.fr';
}

function mt_mail_image_src(string $src, ?array $copy = null): string {
    $src = trim($src);
    if ($src === '' || str_starts_with($src, 'https://') || str_starts_with($src, 'http://')) {
        return $src;
    }
    if (str_starts_with($src, '/')) {
        return mt_mail_public_origin($copy) . $src;
    }
    return $src;
}

function mt_room_image(string $slug): array {
    $copy = mt_load_site_copy();
    $room = is_array($copy['rooms'][$slug] ?? null) ? $copy['rooms'][$slug] : null;
    $src = is_array($room) ? (string) ($room['image'] ?? '') : '';
    if ($src !== '') {
        return [
            'src' => $src,
            'alt' => (string) ($room['imageAlt'] ?? ''),
        ];
    }
    if ($slug === 'vaisseau') {
        return [
            'src' => 'https://images.hostinger.com/c1b6ad64-40d1-40af-90d5-bb894b7f5893.png',
            'alt' => 'Cabine du capitaine d\'un galion abandonné, cartes marines et bougies vacillantes',
        ];
    }
    return [
        'src' => 'https://images.hostinger.com/f2d40922-ae59-47a0-95d4-549223e899bf.png',
        'alt' => 'Bureau du directeur du collège plongé dans la pénombre, lampe verte allumée',
    ];
}

function mt_slot_price_euros(?array $copy = null): int {
    $data = $copy ?? mt_load_site_copy();
    if (!is_array($data)) {
        return 120;
    }
    $n = (int) ($data['reserver']['calendrier']['prixCreneau'] ?? 120);
    return $n > 0 ? $n : 120;
}

function mt_format_price_amount(float $amount): string {
    if (abs($amount - round($amount)) < 0.0001) {
        return (string) (int) round($amount);
    }
    return number_format($amount, 2, ',', '');
}

function mt_price_per_person(int $players, ?int $slotPrice = null): string {
    $slot = $slotPrice ?? mt_slot_price_euros();
    if ($players < 1) {
        return '';
    }
    return mt_format_price_amount($slot / $players);
}

function mt_booking_copy_vars(array $booking, array $env = []): array {
    $copy = mt_load_site_copy();
    $time = $booking['time'] ?? mt_minutes_to_hhmm((int) $booking['start_minute']);
    $links = $env !== [] ? mt_booking_calendar_links($env, $booking) : ['ics' => ''];
    $status = ($booking['status'] ?? '') === 'confirmed' ? 'confirmée' : 'en attente de confirmation';
    $mgrLinks = $env !== [] ? mt_manager_booking_links($env, $booking) : ['voir' => '', 'confirmer' => ''];
    $visual = mt_room_image((string) ($booking['room_slug'] ?? ''));
    $players = (int) ($booking['players'] ?? 0);
    $slotPrice = mt_slot_price_euros($copy);
    return [
        'nom' => (string) ($booking['guest_name'] ?? ''),
        'salle' => mt_room_label((string) ($booking['room_slug'] ?? '')),
        'date' => (string) ($booking['booking_date'] ?? ''),
        'heure' => (string) $time,
        'duree' => (string) mt_occupancy_duration($booking),
        'joueurs' => (string) ($booking['players'] ?? ''),
        'prix' => mt_format_price_amount((float) $slotPrice),
        'prix_personne' => mt_price_per_person($players, $slotPrice),
        'adresse' => (string) ($copy['contact']['address'] ?? '23 Bd de Verdun, 12400 Saint-Affrique'),
        'email' => (string) ($booking['guest_email'] ?? ''),
        'telephone' => (string) ($booking['guest_phone'] ?? ''),
        'lien_ics' => (string) ($links['ics'] ?? ''),
        'lien_voir' => (string) ($mgrLinks['voir'] ?? ''),
        'lien_confirmer' => (string) ($mgrLinks['confirmer'] ?? ''),
        'lien_avis' => ($env !== [] && ($booking['id'] ?? 0) ? mt_review_page_url($env, $booking) : ''),
        'lien_avis_google' => (string) ($copy['contact']['reviewGoogle'] ?? ''),
        'lien_facebook' => (string) ($copy['contact']['facebook'] ?? ''),
        'lien_instagram' => (string) ($copy['contact']['instagram'] ?? ''),
        'statut' => $status,
        'logo' => mt_mail_image_src((string) ($copy['contact']['logo'] ?? 'https://horizons-cdn.hostinger.com/6f05984e-16ed-4597-8f84-cb44fc903b9b/4bd0e6870391b77d0f13cc22e5fda061.jpg'), $copy),
        'logo_alt' => (string) ($copy['contact']['logoAlt'] ?? 'Escape Occitanie'),
        'site' => (string) ($copy['contact']['website'] ?? 'https://escapeoccitanie.fr'),
        'image_salle' => mt_mail_image_src($visual['src'], $copy),
        'image_salle_alt' => $visual['alt'],
    ];
}

function mt_booking_email_parts(array $booking, string $kind, array $env = []): array {
    $copy = mt_load_site_copy();
    $id = 'client-attente';
    if ($kind === 'confirmed') {
        $id = 'client-confirmee';
    } elseif ($kind === 'review') {
        $id = 'client-avis';
    } elseif ($kind === 'modified') {
        $id = 'client-modifiee';
    }
    $vars = mt_booking_copy_vars($booking, $env);
    $tpl = $copy['emails'][$id] ?? null;
    if (is_array($tpl) && ($tpl['sujet'] ?? '') !== '') {
        return [
            'subject' => mt_fill_copy((string) $tpl['sujet'], $vars),
            'text' => mt_fill_copy((string) ($tpl['texte'] ?? ''), $vars),
            'html' => mt_fill_copy((string) ($tpl['html'] ?? ''), $vars),
        ];
    }
    if ($kind === 'review') {
        return [
            'subject' => 'Un petit mot après votre partie — Escape Occitanie',
            'text' => mt_review_customer_email($booking, $env),
            'html' => '',
        ];
    }
    if ($kind === 'modified') {
        return [
            'subject' => 'Modification de réservation — Escape Occitanie',
            'text' => mt_booking_customer_email($booking, $kind, $env),
            'html' => '',
        ];
    }
    $subject = $kind === 'confirmed'
        ? 'Confirmation de réservation — Escape Occitanie'
        : 'Demande de réservation — Escape Occitanie';
    return [
        'subject' => $subject,
        'text' => mt_booking_customer_email($booking, $kind, $env),
        'html' => '',
    ];
}

function mt_manager_email_parts(array $booking, array $env = []): array {
    $copy = mt_load_site_copy();
    $vars = mt_booking_copy_vars($booking, $env);
    $tpl = $copy['emails']['manager-nouvelle'] ?? null;
    if (is_array($tpl) && ($tpl['sujet'] ?? '') !== '') {
        return [
            'subject' => mt_fill_copy((string) $tpl['sujet'], $vars),
            'text' => mt_fill_copy((string) ($tpl['texte'] ?? ''), $vars),
            'html' => mt_fill_copy((string) ($tpl['html'] ?? ''), $vars),
        ];
    }
    return [
        'subject' => 'Nouvelle demande de réservation — Escape Occitanie',
        'text' => mt_booking_manager_email($booking, $env),
        'html' => '',
    ];
}

function mt_mail_alternative(string $text, string $html, string $boundary): string {
    return '--' . $boundary . "\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit\r\n\r\n"
        . $text . "\r\n"
        . '--' . $boundary . "\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit\r\n\r\n"
        . $html . "\r\n"
        . '--' . $boundary . "--\r\n";
}

function mt_mail_identity(string $from): array {
    $from = trim($from);
    if (preg_match('/^(?:"?([^"<]*?)"?\s*)?<([^>]+)>$/', $from, $match) === 1) {
        return [
            'name' => trim($match[1], " \t\""),
            'email' => trim($match[2]),
        ];
    }
    if (filter_var($from, FILTER_VALIDATE_EMAIL)) {
        return ['name' => '', 'email' => $from];
    }
    return ['name' => 'Escape Occitanie', 'email' => 'contact@escapeoccitanie.fr'];
}

function mt_hostinger_send_payload(string $to, string $subject, string $body, ?string $html, ?array $attachment, string $displayName): array {
    $payload = [
        'to' => [$to],
        'subject' => $subject,
        'text' => $body,
    ];
    if ($displayName !== '') {
        $payload['displayName'] = $displayName;
    }
    if (is_string($html) && $html !== '') {
        $payload['html'] = $html;
    }
    if ($attachment && !empty($attachment['content']) && !empty($attachment['filename'])) {
        $mime = (string) ($attachment['mime'] ?? 'application/octet-stream');
        $payload['attachments'] = [[
            'filename' => (string) $attachment['filename'],
            'content' => base64_encode((string) $attachment['content']),
            'contentType' => explode(';', $mime, 2)[0],
            'encoding' => 'base64',
        ]];
    }
    return $payload;
}

function mt_hostinger_api(array $env, string $method, string $path, ?array $json = null): array {
    $token = trim((string) ($env['HOSTINGER_EMAIL_MCP_TOKEN'] ?? ''));
    if ($token === '' || !function_exists('curl_init')) {
        return ['ok' => false, 'status' => 0, 'body' => ''];
    }
    $ch = curl_init('https://api.mail.hostinger.com' . $path);
    $headers = [
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
        'Content-Type: application/json',
    ];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_USERAGENT => 'EscapeOccitanie/1.0',
    ];
    if ($json !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [
        'ok' => $raw !== false && $status >= 200 && $status < 300,
        'status' => $status,
        'body' => is_string($raw) ? $raw : '',
    ];
}

function mt_hostinger_mailbox_id(array $env): string {
    $id = trim((string) ($env['HOSTINGER_MAIL_MAILBOX_ID'] ?? ''));
    if ($id !== '') {
        return $id;
    }
    $res = mt_hostinger_api($env, 'GET', '/api/v1/me');
    if (!$res['ok']) {
        return '';
    }
    $data = json_decode($res['body'], true);
    $mailbox = $data['data']['mailboxes'][0]['resourceId'] ?? '';
    return is_string($mailbox) ? $mailbox : '';
}

function mt_send_via_hostinger(array $env, string $to, string $subject, string $body, ?array $attachment, ?string $html): bool {
    $mailbox = mt_hostinger_mailbox_id($env);
    if ($mailbox === '') {
        return false;
    }
    $from = $env['SMTP_FROM'] ?? 'Escape Occitanie <contact@escapeoccitanie.fr>';
    $identity = mt_mail_identity($from);
    $payload = mt_hostinger_send_payload($to, $subject, $body, $html, $attachment, $identity['name']);
    $res = mt_hostinger_api($env, 'POST', '/api/v1/mailboxes/' . rawurlencode($mailbox) . '/send', $payload);
    return $res['ok'];
}

function mt_send_mail(array $env, string $to, string $subject, string $body, ?array $attachment = null, ?string $html = null): bool {
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    if (mt_send_via_hostinger($env, $to, $subject, $body, $attachment, $html)) {
        return true;
    }
    $from = $env['SMTP_FROM'] ?? 'Escape Occitanie <contact@escapeoccitanie.fr>';
    $encoded = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $identity = mt_mail_identity($from);
    $reply = $identity['email'] !== '' ? $identity['email'] : ($env['MANAGER_EMAIL'] ?? 'contact@escapeoccitanie.fr');
    $hasHtml = is_string($html) && $html !== '';
    $hasFile = $attachment && !empty($attachment['content']) && !empty($attachment['filename']);

    if ($hasFile) {
        $mixed = 'EscBound' . bin2hex(random_bytes(8));
        $filename = str_replace(['"', "\r", "\n"], '', $attachment['filename']);
        $mime = $attachment['mime'] ?? 'text/calendar; method=REQUEST';
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'From: ' . $from,
            'Reply-To: ' . $reply,
            'Content-Type: multipart/mixed; boundary="' . $mixed . '"',
        ]);
        if ($hasHtml) {
            $alt = 'EscAlt' . bin2hex(random_bytes(8));
            $message = '--' . $mixed . "\r\n"
                . 'Content-Type: multipart/alternative; boundary="' . $alt . '"' . "\r\n\r\n"
                . mt_mail_alternative($body, $html, $alt)
                . '--' . $mixed . "\r\n";
        } else {
            $message = '--' . $mixed . "\r\n"
                . "Content-Type: text/plain; charset=UTF-8\r\n"
                . "Content-Transfer-Encoding: 8bit\r\n\r\n"
                . $body . "\r\n"
                . '--' . $mixed . "\r\n";
        }
        $message .= 'Content-Type: ' . $mime . '; charset=UTF-8; name="' . $filename . '"' . "\r\n"
            . "Content-Transfer-Encoding: base64\r\n"
            . 'Content-Disposition: attachment; filename="' . $filename . '"' . "\r\n\r\n"
            . chunk_split(base64_encode($attachment['content']))
            . '--' . $mixed . "--\r\n";
        return @mail($to, $encoded, $message, $headers);
    }

    if ($hasHtml) {
        $alt = 'EscAlt' . bin2hex(random_bytes(8));
        $headers = implode("\r\n", [
            'MIME-Version: 1.0',
            'From: ' . $from,
            'Reply-To: ' . $reply,
            'Content-Type: multipart/alternative; boundary="' . $alt . '"',
        ]);
        return @mail($to, $encoded, mt_mail_alternative($body, $html, $alt), $headers);
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
    } elseif ($kind === 'modified') {
        $intro = "Votre réservation a été modifiée. Voici les nouveaux détails :";
    } else {
        $intro = "Nous avons bien reçu votre demande de réservation. Elle est en attente de confirmation par l'équipe.";
    }
    $copy = mt_load_site_copy();
    $address = is_string($copy['contact']['address'] ?? null)
        ? $copy['contact']['address']
        : '23 Bd de Verdun, 12400 Saint-Affrique';
    $body = "Bonjour {$name},\n\n"
        . "{$intro}\n\n"
        . "Salle : {$room}\n"
        . "Date : {$booking['booking_date']}\n"
        . "Heure : {$time}\n"
        . 'Durée : ' . mt_occupancy_duration($booking) . " minutes\n"
        . "Joueurs : {$booking['players']}\n"
        . 'Prix : ' . mt_format_price_amount((float) mt_slot_price_euros($copy)) . ' € (' . mt_price_per_person((int) $booking['players']) . " € par personne) — pas de CB\n\n"
        . "Merci d'arriver 15 minutes avant le début de la session une fois la réservation confirmée.\n"
        . "Adresse : {$address}\n";
    if (($kind === 'confirmed' || $kind === 'modified') && $env !== []) {
        $links = mt_booking_calendar_links($env, $booking);
        $body .= "\nAjoutez l'événement à votre calendrier : fichier joint (reservation.ics) ou téléchargement : {$links['ics']}\n";
    }
    $body .= "\nÀ très bientôt,\n"
        . "L'équipe Escape Occitanie\n";
    return $body;
}

function mt_booking_manager_email(array $booking, array $env = []): string {
    $room = mt_room_label($booking['room_slug']);
    $time = $booking['time'] ?? mt_minutes_to_hhmm((int) $booking['start_minute']);
    $status = $booking['status'] === 'confirmed' ? 'confirmée' : 'en attente de confirmation';
    $body = "Nouvelle réservation ({$status})\n\n"
        . "Salle : {$room}\n"
        . "Date : {$booking['booking_date']} à {$time}\n"
        . "Joueurs : {$booking['players']}\n"
        . 'Prix : ' . mt_format_price_amount((float) mt_slot_price_euros()) . ' € (' . mt_price_per_person((int) $booking['players']) . " € par personne)\n"
        . "Nom : {$booking['guest_name']}\n"
        . "E-mail : {$booking['guest_email']}\n"
        . "Téléphone : {$booking['guest_phone']}\n";
    if ($env !== []) {
        $links = mt_manager_booking_links($env, $booking);
        $body .= "\nConfirmer : {$links['confirmer']}\n"
            . "Voir : {$links['voir']}\n";
    }
    return $body;
}

function mt_html(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function mt_manager_confirm_page_html(array $booking, string $state, array $links = [], string $message = ''): string {
    $name = mt_html((string) ($booking['guest_name'] ?? ''));
    $room = mt_html(mt_room_label((string) ($booking['room_slug'] ?? '')));
    $date = mt_html((string) ($booking['booking_date'] ?? ''));
    $time = mt_html((string) ($booking['time'] ?? (isset($booking['start_minute']) ? mt_minutes_to_hhmm((int) $booking['start_minute']) : '')));
    $players = mt_html((string) ($booking['players'] ?? ''));
    $email = mt_html((string) ($booking['guest_email'] ?? ''));
    $phone = mt_html((string) ($booking['guest_phone'] ?? ''));
    $view = mt_html((string) ($links['voir'] ?? ''));
    $confirm = (string) ($links['confirmer'] ?? '');
    $token = mt_html((string) ($links['token'] ?? ''));
    $id = (int) ($booking['id'] ?? 0);
    $title = 'Réservation';
    $lead = $message !== '' ? mt_html($message) : '';
    $form = '';
    if ($state === 'form') {
        $title = 'Confirmer la réservation';
        $lead = $lead !== '' ? $lead : 'Un clic suffit pour valider cette demande et envoyer l’e-mail au client.';
        $form = '<form method="post" action="' . mt_html($confirm) . '">'
            . '<input type="hidden" name="b" value="' . $id . '">'
            . '<input type="hidden" name="t" value="' . $token . '">'
            . '<button type="submit">Confirmer la réservation</button>'
            . '</form>';
    } elseif ($state === 'confirmed') {
        $title = 'Réservation confirmée';
        $lead = $lead !== '' ? $lead : 'La réservation est confirmée. Le client a reçu l’e-mail.';
    } elseif ($state === 'already') {
        $title = 'Déjà confirmée';
        $lead = $lead !== '' ? $lead : 'Cette réservation est déjà confirmée.';
    } elseif ($state === 'conflict') {
        $title = 'Impossible de confirmer';
        $lead = $lead !== '' ? $lead : 'Le créneau n’est plus disponible.';
    } else {
        $title = 'Lien invalide';
        $lead = $lead !== '' ? $lead : 'Ce lien de confirmation n’est plus valable.';
    }
    $details = $name === '' && $date === ''
        ? ''
        : '<p>'
            . 'Salle : ' . $room . '<br>'
            . 'Date : ' . $date . ($time !== '' ? ' à ' . $time : '') . '<br>'
            . 'Joueurs : ' . $players . '<br>'
            . 'Prix : ' . mt_html(mt_format_price_amount((float) mt_slot_price_euros()) . ' € (' . mt_price_per_person((int) ($booking['players'] ?? 0)) . ' € par personne)') . '<br>'
            . 'Nom : ' . $name . '<br>'
            . 'E-mail : ' . $email . '<br>'
            . 'Téléphone : ' . $phone
            . '</p>';
    $viewBlock = $view !== '' ? '<p><a href="' . $view . '">Voir la réservation</a></p>' : '';
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . mt_html($title) . ' — Escape Occitanie</title>'
        . '<style>'
        . 'body{margin:0;background:#1a1612;color:#e8dcc8;font-family:Georgia,serif;}'
        . '.box{max-width:32rem;margin:12vh auto;padding:28px 22px;background:#241f1a;border-radius:12px;}'
        . 'h1{font-size:1.4rem;color:#f4ead6;margin:0 0 12px;}'
        . 'p{line-height:1.55;}'
        . 'button{background:#c9a227;color:#1a1612;border:0;border-radius:8px;padding:12px 18px;font-weight:700;cursor:pointer;}'
        . 'a{color:#c9a227;}'
        . '</style></head><body><div class="box"><p style="letter-spacing:3px;color:#c9a227;text-transform:uppercase;font-size:12px;">Escape Occitanie</p>'
        . '<h1>' . mt_html($title) . '</h1>'
        . '<p>' . $lead . '</p>'
        . $details
        . $form
        . $viewBlock
        . '</div></body></html>';
}

function mt_review_page_html(array $booking, string $state): string {
    $copy = mt_load_site_copy();
    $room = mt_html(mt_room_label((string) ($booking['room_slug'] ?? '')));
    $date = mt_html((string) ($booking['booking_date'] ?? ''));
    $google = mt_html((string) ($copy['contact']['reviewGoogle'] ?? ''));
    $facebook = mt_html((string) ($copy['contact']['facebook'] ?? ''));
    $instagram = mt_html((string) ($copy['contact']['instagram'] ?? ''));
    if ($state !== 'ok') {
        $title = 'Lien invalide';
        $lead = 'Ce lien d’avis est incorrect.';
        $body = '';
    } else {
        $title = 'Merci';
        $lead = 'Merci d’avoir joué à ' . $room . ' le ' . $date . '.';
        $body = '<p class="btns">'
            . '<a class="btn" href="' . $google . '">Google</a>'
            . '<a class="btn" href="' . $facebook . '">Facebook</a>'
            . '<a class="btn" href="' . $instagram . '">Instagram</a>'
            . '</p>'
            . '<p>Envoyez cette page aux autres joueurs de votre équipe.</p>'
            . '<p class="btns">'
            . '<button type="button" id="share">Partager</button>'
            . '<button type="button" id="copy">Copier le lien</button>'
            . '</p>'
            . '<script>'
            . '(function () {'
            . 'var url = location.href;'
            . 'var share = document.getElementById("share");'
            . 'var copy = document.getElementById("copy");'
            . 'if (share) {'
            . 'if (!navigator.share) share.hidden = true;'
            . 'share.addEventListener("click", function () {'
            . 'navigator.share({ title: document.title, url: url, text: "Un petit mot après votre partie — Escape Occitanie" });'
            . '});'
            . '}'
            . 'if (copy) {'
            . 'copy.addEventListener("click", function () {'
            . 'if (navigator.clipboard && navigator.clipboard.writeText) {'
            . 'navigator.clipboard.writeText(url);'
            . '}'
            . '});'
            . '}'
            . '})();'
            . '</script>';
    }
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . mt_html($title) . ' — Escape Occitanie</title>'
        . '<style>'
        . 'body{margin:0;background:#1a1612;color:#e8dcc8;font-family:Georgia,serif;}'
        . '.box{max-width:32rem;margin:12vh auto;padding:28px 22px;background:#241f1a;border-radius:12px;}'
        . 'h1{font-size:1.4rem;color:#f4ead6;margin:0 0 12px;}'
        . 'p{line-height:1.55;}'
        . '.btns{display:flex;flex-wrap:wrap;gap:10px;}'
        . 'button,.btn{background:#c9a227;color:#1a1612;border:0;border-radius:8px;padding:12px 18px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block;}'
        . 'a{color:#c9a227;}'
        . '</style></head><body><div class="box"><p style="letter-spacing:3px;color:#c9a227;text-transform:uppercase;font-size:12px;">Escape Occitanie</p>'
        . '<h1>' . mt_html($title) . '</h1>'
        . '<p>' . $lead . '</p>'
        . $body
        . '</div></body></html>';
}

function mt_booking_ics_attachment(array $booking, array $env = []): array {
    return [
        'filename' => 'reservation-escape-occitanie.ics',
        'mime' => 'text/calendar; method=REQUEST',
        'content' => mt_booking_ics($booking, $env),
    ];
}

function mt_send_booking_emails(array $env, array $booking, string $kind, bool $notifyManager = false): bool {
    $parts = mt_booking_email_parts($booking, $kind, $env);
    $attachment = ($kind === 'confirmed' || $kind === 'modified') ? mt_booking_ics_attachment($booking, $env) : null;
    $sent = mt_send_mail(
        $env,
        $booking['guest_email'],
        $parts['subject'],
        $parts['text'],
        $attachment,
        $parts['html'] !== '' ? $parts['html'] : null
    );
    $manager = $env['MANAGER_EMAIL'] ?? '';
    if (($kind === 'pending' || $notifyManager) && $manager !== '') {
        $mgr = mt_manager_email_parts($booking, $env);
        mt_send_mail($env, $manager, $mgr['subject'], $mgr['text'], null, $mgr['html'] !== '' ? $mgr['html'] : null);
    }
    return $sent;
}

function mt_review_customer_email(array $booking, array $env = []): string {
    $name = (string) ($booking['guest_name'] ?? '');
    $room = mt_room_label((string) ($booking['room_slug'] ?? ''));
    $date = (string) ($booking['booking_date'] ?? '');
    $link = $env !== [] ? mt_review_page_url($env, $booking) : '';
    return "Bonjour {$name},\n\n"
        . "Merci d'avoir joué à {$room} le {$date}. Si l'expérience vous a plu, un avis nous aide beaucoup. Transmettez ce lien aux autres joueurs de votre équipe :\n"
        . "{$link}\n\n"
        . "À très bientôt,\n"
        . "L'équipe Escape Occitanie\n";
}

function mt_send_review_email(array $env, array $booking): bool {
    $parts = mt_booking_email_parts($booking, 'review', $env);
    return mt_send_mail(
        $env,
        (string) ($booking['guest_email'] ?? ''),
        $parts['subject'],
        $parts['text'],
        null,
        $parts['html'] !== '' ? $parts['html'] : null
    );
}
