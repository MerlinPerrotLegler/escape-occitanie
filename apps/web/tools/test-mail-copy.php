<?php
declare(strict_types=1);

require dirname(__DIR__) . '/public/api/bootstrap.php';

$failed = 0;
function expect($cond, $msg) {
    global $failed;
    if (!$cond) {
        fwrite(STDERR, "FAIL: $msg\n");
        $failed++;
    }
}

expect(mt_fill_copy('Bonjour {nom}', ['nom' => 'Ada']) === 'Bonjour Ada', 'fill simple');
expect(mt_fill_copy('Réserver « {nom-court} »', ['nom-court' => 'Le Directeur']) === 'Réserver « Le Directeur »', 'fill hyphen');
expect(mt_fill_copy('Lien {lien_ics}', ['lien_ics' => 'https://x/ics']) === 'Lien https://x/ics', 'fill underscore');
expect(mt_fill_copy('reste {inconnu}', []) === 'reste {inconnu}', 'unknown kept');

$booking = [
    'id' => 17,
    'room_slug' => 'directeur',
    'guest_name' => 'Ada',
    'guest_email' => 'ada@example.com',
    'guest_phone' => '0612345678',
    'booking_date' => '2026-09-10',
    'time' => '14:00',
    'start_minute' => 14 * 60,
    'players' => 4,
    'status' => 'pending',
    'occupancy_minutes' => 60,
    'duration_minutes' => 60,
];

$fallback = mt_booking_customer_email($booking, 'pending');
expect(str_contains($fallback, 'Bonjour Ada'), 'fallback greeting');
expect(str_contains($fallback, 'Convocation chez le Directeur') || str_contains($fallback, 'Ada'), 'fallback has room or name');

$copy = mt_load_site_copy();
if (is_array($copy) && isset($copy['emails']['client-attente'])) {
    $parts = mt_booking_email_parts($booking, 'pending');
    expect($parts['subject'] === 'Demande de réservation — Escape Occitanie', 'pending subject from xml');
    expect(str_contains($parts['html'], 'Ada'), 'html filled name');
    expect(!str_contains($parts['html'], '{nom}'), 'html placeholder gone');
    expect(str_contains($parts['html'], '4bd0e6870391b77d0f13cc22e5fda061.jpg'), 'html has logo');
    expect(str_contains($parts['html'], 'f2d40922-ae59-47a0-95d4-549223e899bf.png'), 'html has directeur image');
    expect(!str_contains($parts['html'], '{logo}'), 'logo placeholder gone');
    expect(!str_contains($parts['html'], '{image_salle}'), 'room image placeholder gone');
    expect(str_contains($parts['text'], 'Ada'), 'text filled name');
    $vaisseau = mt_booking_email_parts(array_merge($booking, ['room_slug' => 'vaisseau']), 'pending');
    expect(str_contains($vaisseau['html'], 'c1b6ad64-40d1-40af-90d5-bb894b7f5893.png'), 'html has vaisseau image');
    $confirmed = mt_booking_email_parts(array_merge($booking, ['status' => 'confirmed', 'id' => 1]), 'confirmed', [
        'AUTH_URL' => 'https://escapeoccitanie.fr',
        'AUTH_SECRET' => 'test-secret',
    ]);
    expect($confirmed['subject'] === 'Confirmation de réservation — Escape Occitanie', 'confirmed subject');
    expect(str_contains($confirmed['html'], 'calendar.php'), 'confirmed html has ics link');
    expect(!str_contains($confirmed['html'], 'Google Agenda'), 'confirmed html has no google agenda');
    expect(!str_contains($confirmed['html'], 'calendar.google.com'), 'confirmed html has no google template');
    expect(!str_contains($confirmed['text'], 'Google Agenda'), 'confirmed text has no google agenda');
    $mgr = mt_manager_email_parts($booking, [
        'AUTH_URL' => 'https://escapeoccitanie.fr',
        'AUTH_SECRET' => 'test-secret',
    ]);
    expect($mgr['subject'] === 'Nouvelle demande de réservation — Escape Occitanie', 'manager subject');
    expect(str_contains($mgr['html'], 'confirm-booking.php'), 'manager html has confirm link');
    expect(str_contains($mgr['html'], '/maitre#reservations/'), 'manager html has view link');
    expect(str_contains($mgr['text'], 'confirm-booking.php') || str_contains($mgr['text'], 'Confirmer'), 'manager text has confirm');
} else {
    fwrite(STDERR, "SKIP: site-copy.json absent, template assertions skipped\n");
}

$identity = mt_mail_identity('Escape Occitanie <contact@escapeoccitanie.fr>');
expect($identity['name'] === 'Escape Occitanie', 'from name parsed');
expect($identity['email'] === 'contact@escapeoccitanie.fr', 'from email parsed');
$payload = mt_hostinger_send_payload(
    'ada@example.com',
    'Sujet',
    'Texte',
    '<p>Html</p>',
    ['filename' => 'reservation.ics', 'content' => 'BEGIN:VCALENDAR', 'mime' => 'text/calendar; method=PUBLISH'],
    'Escape Occitanie'
);
expect($payload['to'] === ['ada@example.com'], 'payload to');
expect($payload['displayName'] === 'Escape Occitanie', 'payload display name');
expect($payload['html'] === '<p>Html</p>', 'payload html');
expect($payload['attachments'][0]['encoding'] === 'base64', 'attachment encoding');
expect($payload['attachments'][0]['contentType'] === 'text/calendar', 'attachment mime stripped');
expect($payload['attachments'][0]['content'] === base64_encode('BEGIN:VCALENDAR'), 'attachment base64');
expect(mt_send_mail(['HOSTINGER_EMAIL_MCP_TOKEN' => ''], 'not-an-email', 'x', 'y') === false, 'invalid recipient rejected');

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
