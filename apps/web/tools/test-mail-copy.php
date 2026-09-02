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
    expect(str_contains($parts['text'], 'Ada'), 'text filled name');
    $confirmed = mt_booking_email_parts(array_merge($booking, ['status' => 'confirmed', 'id' => 1]), 'confirmed', [
        'AUTH_URL' => 'https://escapeoccitanie.fr',
        'AUTH_SECRET' => 'test-secret',
    ]);
    expect($confirmed['subject'] === 'Confirmation de réservation — Escape Occitanie', 'confirmed subject');
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

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
