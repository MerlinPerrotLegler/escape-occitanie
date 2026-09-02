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

expect(mt_price_per_person(3, 120) === '40', '3 players = 40');
expect(mt_price_per_person(4, 120) === '30', '4 players = 30');
expect(mt_price_per_person(5, 120) === '24', '5 players = 24');
expect(mt_price_per_person(6, 120) === '20', '6 players = 20');
expect(mt_format_price_amount(40.5) === '40,50', 'decimal price');
expect(mt_slot_price_euros(['reserver' => ['calendrier' => ['prixCreneau' => 120]]]) === 120, 'slot from copy');

expect(mt_mail_image_src('https://images.hostinger.com/x.png') === 'https://images.hostinger.com/x.png', 'absolute url kept');
expect(
    mt_mail_image_src('/media/logo.jpg', ['contact' => ['website' => 'https://escapeoccitanie.fr']])
        === 'https://escapeoccitanie.fr/media/logo.jpg',
    'relative media prefixed with site'
);
expect(mt_mail_image_src('') === '', 'empty src kept');

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
expect(str_contains($fallback, '120 €'), 'fallback has slot price');
expect(str_contains($fallback, '30 € par personne'), 'fallback has per-person price');
expect(str_contains($fallback, 'pas de CB'), 'fallback has no card');
$fallbackModified = mt_booking_customer_email(array_merge($booking, ['status' => 'confirmed']), 'modified');
expect(str_contains($fallbackModified, 'modifiée'), 'fallback modified says the booking changed');
expect(!str_contains($fallbackModified, 'Votre réservation est confirmée.'), 'fallback modified is not the confirmation copy');

$copy = mt_load_site_copy();
if (is_array($copy) && isset($copy['emails']['client-attente'])) {
    $parts = mt_booking_email_parts($booking, 'pending');
    expect($parts['subject'] === 'Demande de réservation — Escape Occitanie', 'pending subject from xml');
    expect(str_contains($parts['html'], 'Ada'), 'html filled name');
    expect(!str_contains($parts['html'], '{nom}'), 'html placeholder gone');
    expect(str_contains($parts['html'], '/media/logo.'), 'html has logo');
    expect(str_contains($parts['html'], '/media/bureau-directeur-1.'), 'html has directeur image');
    expect(!str_contains($parts['html'], '{logo}'), 'logo placeholder gone');
    expect(!str_contains($parts['html'], '{image_salle}'), 'room image placeholder gone');
    expect(str_contains($parts['text'], 'Ada'), 'text filled name');
    $vaisseau = mt_booking_email_parts(array_merge($booking, ['room_slug' => 'vaisseau']), 'pending');
    expect(str_contains($vaisseau['html'], '/media/vaisseau-1.'), 'html has vaisseau image');
    $confirmed = mt_booking_email_parts(array_merge($booking, ['status' => 'confirmed', 'id' => 1]), 'confirmed', [
        'AUTH_URL' => 'https://escapeoccitanie.fr',
        'AUTH_SECRET' => 'test-secret',
    ]);
    expect($confirmed['subject'] === 'Confirmation de réservation — Escape Occitanie', 'confirmed subject');
    expect(str_contains($confirmed['html'], '120 €'), 'confirmed html has slot price');
    expect(str_contains($confirmed['html'], '30 € par personne'), 'confirmed html has per-person price');
    expect(str_contains($confirmed['html'], 'pas de CB'), 'confirmed html has no card');
    expect(str_contains($confirmed['text'], '120 €'), 'confirmed text has slot price');
    expect(str_contains($confirmed['text'], '30 € par personne'), 'confirmed text has per-person price');
    expect(str_contains($confirmed['text'], 'pas de CB'), 'confirmed text has no card');
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
    $review = mt_booking_email_parts(array_merge($booking, ['status' => 'confirmed', 'id' => 1]), 'review', [
        'AUTH_URL' => 'https://escapeoccitanie.fr',
        'AUTH_SECRET' => 'test-secret',
    ]);
    expect($review['subject'] === 'Un petit mot après votre partie — Escape Occitanie', 'review subject');
    expect(str_contains($review['html'], '/api/avis.php?b=1'), 'review html has page link');
    expect(!str_contains($review['html'], 'search.google.com/local/writereview'), 'review mail has no google review url');
    expect(!str_contains($review['html'], 'facebook.com'), 'review mail has no facebook url');
    expect(str_contains($review['text'], 'avis.php'), 'review text has page link');
    $modified = mt_booking_email_parts(array_merge($booking, ['status' => 'confirmed', 'id' => 1]), 'modified', [
        'AUTH_URL' => 'https://escapeoccitanie.fr',
        'AUTH_SECRET' => 'test-secret',
    ]);
    expect($modified['subject'] === 'Modification de réservation — Escape Occitanie', 'modified subject from xml');
    expect(str_contains($modified['html'], 'modifiée'), 'modified html says the booking changed');
    expect(str_contains($modified['html'], 'calendar.php'), 'modified html has ics link');
    expect(!str_contains($modified['html'], 'Votre réservation est confirmée.'), 'modified html is not the confirmation copy');
    expect(str_contains($modified['text'], 'modifiée'), 'modified text says the booking changed');
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

$htmlOk = mt_review_page_html([
    'id' => 1,
    'guest_name' => 'Ada',
    'room_slug' => 'directeur',
    'booking_date' => '2026-09-01',
    'status' => 'confirmed',
], 'ok');
expect(str_contains($htmlOk, 'Ada') || str_contains($htmlOk, 'Directeur') || str_contains($htmlOk, '2026-09-01'), 'review page has booking');
expect(str_contains($htmlOk, 'Google'), 'review page Google');
expect(str_contains($htmlOk, 'Facebook'), 'review page Facebook');
expect(str_contains($htmlOk, 'Instagram'), 'review page Instagram');
expect(str_contains($htmlOk, 'autres joueurs'), 'review page asks to share');
expect(str_contains($htmlOk, '/favicon-48x48.png'), 'review page favicon');
expect(str_contains($htmlOk, 'navigator.share') || str_contains($htmlOk, 'clipboard'), 'review page share or copy');
$htmlBad = mt_review_page_html([], 'invalid');
expect(str_contains($htmlBad, 'invalide'), 'invalid copy');
expect(!str_contains($htmlBad, 'plus valable'), 'invalid copy does not say expired');

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
