<?php
declare(strict_types=1);

$root = dirname(__DIR__) . '/public/api/lib';
require $root . '/env.php';
require $root . '/validate.php';
require $root . '/auth.php';
require $root . '/turnstile.php';

$failed = 0;
function expect($cond, $msg) {
    global $failed;
    if (!$cond) {
        fwrite(STDERR, "FAIL: $msg\n");
        $failed++;
    }
}

$envTmp = sys_get_temp_dir() . '/mt-env-' . bin2hex(random_bytes(4));
mkdir($envTmp . '/api', 0700, true);
mkdir($envTmp . '/.git', 0700, true);
file_put_contents($envTmp . '/.env', "MANAGER_EMAIL=root@example.com\nMANAGER_PASSWORD=root-pass\nAUTH_SECRET=root-secret\nDATABASE_URL=mysql://prod:x@db:3306/prod\n");
file_put_contents($envTmp . '/api/.env', "MANAGER_EMAIL=local@example.com\nMANAGER_PASSWORD=local-pass\nAUTH_SECRET=local-secret\nMYSQL_HOST=127.0.0.1\nMYSQL_USER=root\n");
$loaded = mt_load_env($envTmp . '/api');
expect(($loaded['MANAGER_EMAIL'] ?? '') === 'root@example.com', 'repo-root manager email wins over api/.env');
expect(($loaded['MANAGER_PASSWORD'] ?? '') === 'root-pass', 'repo-root manager password wins over api/.env');
expect(($loaded['AUTH_SECRET'] ?? '') === 'root-secret', 'repo-root auth secret wins over api/.env');
expect(($loaded['MYSQL_HOST'] ?? '') === '127.0.0.1', 'local mysql host kept');
$solo = sys_get_temp_dir() . '/mt-env-solo-' . bin2hex(random_bytes(4));
mkdir($solo . '/api', 0700, true);
file_put_contents($solo . '/api/.env', "MANAGER_EMAIL=only-local@example.com\nAUTH_SECRET=only-local-secret\n");
$soloLoaded = mt_load_env($solo . '/api');
expect(($soloLoaded['MANAGER_EMAIL'] ?? '') === 'only-local@example.com', 'api/.env manager used when no parent .env');
foreach ([$envTmp . '/api/.env', $envTmp . '/.env', $solo . '/api/.env'] as $f) {
    @unlink($f);
}
@rmdir($envTmp . '/.git');
@rmdir($envTmp . '/api');
@rmdir($envTmp);
@rmdir($solo . '/api');
@rmdir($solo);

$url = 'mysql://demo_user:p?assw0rd@db.example:3306/demo_db';
$parsed = mt_parse_database_url($url);
expect(($parsed['pass'] ?? '') === 'p?assw0rd', 'password with ? parsed');
expect(($parsed['user'] ?? '') === 'demo_user', 'user parsed');
expect(($parsed['host'] ?? '') === 'db.example', 'host parsed');
expect((int)($parsed['port'] ?? 0) === 3306, 'port parsed');
expect(($parsed['dbname'] ?? '') === 'demo_db', 'db parsed');

$bad = mt_validate_content(['reviews' => [], 'records' => []]);
expect($bad['ok'] === false, 'empty payload rejected');

$okPayload = [
    'reviews' => [
        ['slot' => 1, 'name' => 'A', 'city' => 'Albi', 'text' => 'Super', 'stars' => 5],
        ['slot' => 2, 'name' => 'B', 'city' => 'Toulouse', 'text' => 'Top', 'stars' => 4],
        ['slot' => 3, 'name' => 'C', 'city' => 'Castres', 'text' => 'Cool', 'stars' => 1],
    ],
    'records' => [
        'directeur' => [
            ['rank' => 1, 'team' => 'Alpha', 'time' => '38:42'],
            ['rank' => 2, 'team' => 'Beta', 'time' => '41:07'],
            ['rank' => 3, 'team' => 'Gamma', 'time' => '44:55'],
        ],
        'vaisseau' => [
            ['rank' => 1, 'team' => 'Crew', 'time' => '39:18'],
            ['rank' => 2, 'team' => 'Sail', 'time' => '42:51'],
            ['rank' => 3, 'team' => 'Win', 'time' => '47:03'],
        ],
    ],
];
$ok = mt_validate_content($okPayload);
expect($ok['ok'] === true, 'valid payload accepted');

$stars = $okPayload;
$stars['reviews'][0]['stars'] = 6;
expect(mt_validate_content($stars)['ok'] === false, 'stars 6 rejected');

$starsFloat = $okPayload;
$starsFloat['reviews'][0]['stars'] = 3.7;
expect(mt_validate_content($starsFloat)['ok'] === false, 'stars 3.7 rejected');

$starsString = $okPayload;
$starsString['reviews'][0]['stars'] = '4';
expect(mt_validate_content($starsString)['ok'] === false, 'stars string rejected');

$starsBool = $okPayload;
$starsBool['reviews'][0]['stars'] = true;
expect(mt_validate_content($starsBool)['ok'] === false, 'stars bool rejected');

$time = $okPayload;
$time['records']['directeur'][0]['time'] = '61:00';
expect(mt_validate_content($time)['ok'] === false, 'time 61:00 rejected');

$secret = 'test-secret-key-for-hmac';
$cookie = mt_issue_cookie('contact@example.fr', $secret, 60);
$session = mt_verify_cookie($cookie, $secret);
expect(($session['email'] ?? '') === 'contact@example.fr', 'cookie roundtrip');
expect(mt_verify_cookie($cookie, 'wrong') === null, 'bad secret rejected');
expect(mt_verify_cookie('tampered', $secret) === null, 'tamper rejected');

$monthCookie = mt_issue_cookie('contact@example.fr', $secret, MT_TTL_REMEMBER);
$monthParts = explode('.', substr($monthCookie, 3), 2);
$monthPayload = json_decode(mt_b64url_decode($monthParts[0]) ?? '', true);
expect(is_array($monthPayload), 'remember payload decoded');
expect((int) ($monthPayload['exp'] ?? 0) >= time() + MT_TTL_REMEMBER - 2, 'remember ttl is 1 month');
expect(MT_TTL_REMEMBER === 2592000, 'remember ttl constant is 30 days');
expect(MT_TTL_SESSION === 43200, 'session ttl constant is 12 hours');

$ip = 'test-ip-' . bin2hex(random_bytes(4));
expect(mt_rate_limit_hit($ip) === false, 'first hit allowed');
for ($i = 0; $i < 4; $i++) {
    mt_rate_limit_hit($ip);
}
expect(mt_rate_limit_hit($ip) === true, '6th hit blocked');

$okName = mt_validate_guest_name('Jean-Luc');
expect(($okName['ok'] ?? false) === true && $okName['value'] === 'Jean-Luc', 'php name hyphen');
$okCurly = mt_validate_guest_name("O’Brien");
expect(($okCurly['ok'] ?? false) === true, 'php name curly apostrophe');
$trimName = mt_validate_guest_name('  Marie Claire  ');
expect(($trimName['ok'] ?? false) === true && $trimName['value'] === 'Marie Claire', 'php name trim');
$short = mt_validate_guest_name('A');
expect(($short['ok'] ?? false) === false && $short['error'] === 'Indiquez un nom (au moins 2 lettres).', 'php name too short');
$punct = mt_validate_guest_name('--');
expect(($punct['ok'] ?? false) === false, 'php name punctuation');
$digits = mt_validate_guest_name('123');
expect(($digits['ok'] ?? false) === false, 'php name digits');

$okMail = mt_validate_guest_email('  paul@example.com  ');
expect(($okMail['ok'] ?? false) === true && $okMail['value'] === 'paul@example.com', 'php email trim');
$badMail = mt_validate_guest_email('not-an-email');
expect(($badMail['ok'] ?? false) === false && $badMail['error'] === 'E-mail invalide.', 'php email invalid');

$okPhone = mt_validate_guest_phone('+33 6 12 34 56 78');
expect(($okPhone['ok'] ?? false) === true && $okPhone['value'] === '+33 6 12 34 56 78', 'php phone keeps formatting');
$shortPhone = mt_validate_guest_phone('1234');
expect(($shortPhone['ok'] ?? false) === false && $shortPhone['error'] === 'Numéro de téléphone invalide.', 'php phone short');
$lettersPhone = mt_validate_guest_phone('abc');
expect(($lettersPhone['ok'] ?? false) === false, 'php phone letters');

$tooFewDir = mt_validate_players('directeur', 3);
expect(($tooFewDir['ok'] ?? false) === false && $tooFewDir['error'] === 'Entre 4 et 6 joueurs.', 'php directeur rejects 3 players');
$okDir = mt_validate_players('directeur', 4);
expect(($okDir['ok'] ?? false) === true, 'php directeur accepts 4 players');
$okShip = mt_validate_players('vaisseau', 3);
expect(($okShip['ok'] ?? false) === true, 'php vaisseau still accepts 3 players');
$tooMany = mt_validate_players('vaisseau', 7);
expect(($tooMany['ok'] ?? false) === false && $tooMany['error'] === 'Entre 3 et 6 joueurs.', 'php vaisseau rejects 7 players');

require $root . '/schedule.php';
require $root . '/mail.php';
require $root . '/calendar.php';

$booking = [
    'id' => 42,
    'room_slug' => 'directeur',
    'booking_date' => '2026-09-10',
    'start_minute' => 720,
    'time' => '12:00',
    'players' => 4,
    'guest_email' => 'paul@example.com',
    'guest_name' => 'Paul',
];
$ics = mt_booking_ics($booking);
expect(str_contains($ics, 'BEGIN:VEVENT'), 'ics has event');
expect(str_contains($ics, 'DTSTART:20260910T100000Z') || str_contains($ics, 'DTSTART:20260910T110000Z'), 'ics start in UTC');
expect(str_contains($ics, 'METHOD:REQUEST'), 'ics is an updatable calendar invite');
expect(str_contains($ics, 'SEQUENCE:0'), 'first invite starts at sequence 0');
expect(str_contains($ics, 'UID:booking-42@escapeoccitanie.fr'), 'ics uid is stable per booking');
expect(str_contains($ics, 'ORGANIZER;'), 'ics has organizer');
expect(str_contains($ics, 'ATTENDEE;') && str_contains($ics, 'mailto:paul@example.com'), 'ics addresses the guest');
$icsMoved = mt_booking_ics(array_merge($booking, ['ics_sequence' => 1, 'start_minute' => 780, 'time' => '13:00']));
expect(str_contains($icsMoved, 'UID:booking-42@escapeoccitanie.fr'), 'updated ics keeps the same uid');
expect(str_contains($icsMoved, 'SEQUENCE:1'), 'moved booking increments sequence');
expect(str_contains($icsMoved, 'DTSTART:20260910T110000Z') || str_contains($icsMoved, 'DTSTART:20260910T120000Z'), 'updated ics has new start');
expect(mt_should_refresh_guest_calendar($booking, array_merge($booking, ['status' => 'confirmed', 'start_minute' => 780])) === true, 'confirmed time change refreshes guest calendar');
expect(mt_should_refresh_guest_calendar(array_merge($booking, ['status' => 'confirmed']), array_merge($booking, ['status' => 'confirmed'])) === false, 'same slot does not refresh calendar');
expect(mt_should_refresh_guest_calendar($booking, array_merge($booking, ['status' => 'pending', 'start_minute' => 780])) === false, 'pending move does not send calendar update');
$envCal = ['AUTH_SECRET' => 'test-secret-key-for-hmac', 'AUTH_URL' => 'http://localhost:3000'];
$token = mt_calendar_token($envCal, 42, 'paul@example.com');
expect(mt_calendar_token_ok($envCal, 42, 'paul@example.com', $token) === true, 'calendar token ok');
expect(mt_calendar_token_ok($envCal, 42, 'other@example.com', $token) === false, 'calendar token rejects other email');
$links = mt_booking_calendar_links($envCal, $booking);
expect(str_contains($links['ics'], '/api/calendar.php?b=42'), 'ics download link');
expect(!array_key_exists('google', $links), 'no google calendar template link');

$confirmToken = mt_manager_confirm_token($envCal, 42, 'paul@example.com');
expect($confirmToken !== '', 'manager confirm token issued');
expect(mt_manager_confirm_token_ok($envCal, 42, 'paul@example.com', $confirmToken) === true, 'manager confirm token ok');
expect(mt_manager_confirm_token_ok($envCal, 42, 'other@example.com', $confirmToken) === false, 'manager confirm token rejects other email');
expect(mt_manager_confirm_token_ok($envCal, 41, 'paul@example.com', $confirmToken) === false, 'manager confirm token rejects other booking');
$mgrLinks = mt_manager_booking_links($envCal, $booking);
expect(str_contains($mgrLinks['voir'], '/maitre#reservations/42'), 'view link points at maitre booking');
expect(str_contains($mgrLinks['voir'], 'filtre=toutes'), 'view link uses all-bookings filter');
expect(str_contains($mgrLinks['confirmer'], '/api/confirm-booking.php?b=42'), 'confirm link hits confirm endpoint');
expect(str_contains($mgrLinks['confirmer'], 't='), 'confirm link includes token');

$formHtml = mt_manager_confirm_page_html($booking, 'form', $mgrLinks);
expect(str_contains($formHtml, 'Paul'), 'confirm page shows guest');
expect(str_contains($formHtml, 'method="post"') || str_contains($formHtml, "method='post'"), 'confirm page posts');
expect(str_contains($formHtml, 'Confirmer'), 'confirm page has confirm action');
$okHtml = mt_manager_confirm_page_html(array_merge($booking, ['status' => 'confirmed']), 'already', $mgrLinks);
expect(str_contains($okHtml, 'déjà') || str_contains($okHtml, 'confirmée'), 'already confirmed page');

$secretEnv = ['TURNSTILE_SECRET_KEY' => 'test-secret', 'TURNSTILE_SITE_KEY' => 'test-site'];
$okPost = static function (string $url, array $fields): array {
    expect($url === MT_TURNSTILE_VERIFY_URL, 'siteverify url');
    expect(($fields['secret'] ?? '') === 'test-secret', 'siteverify secret');
    expect(($fields['response'] ?? '') === 'tok', 'siteverify token');
    expect(($fields['remoteip'] ?? '') === '203.0.113.9', 'siteverify ip');
    return ['ok' => true, 'status' => 200, 'body' => '{"success":true}'];
};

$skipCalled = false;
$mustNotSkipPost = static function () use (&$skipCalled): array {
    $skipCalled = true;
    return ['ok' => true, 'status' => 200, 'body' => '{"success":true}'];
};
$emptySecret = mt_turnstile_verify(['TURNSTILE_SITE_KEY' => 'site-only'], 'tok', '203.0.113.9', $mustNotSkipPost);
expect($emptySecret['ok'] === true, 'missing secret skips captcha');
expect(!empty($emptySecret['skipped']), 'missing secret skipped flag');
expect($skipCalled === false, 'missing secret skips siteverify');

$noKeys = mt_turnstile_verify([], '', '203.0.113.9', $mustNotSkipPost);
expect($noKeys['ok'] === true, 'no keys skips even without token');
expect(!empty($noKeys['skipped']), 'no keys skipped flag');

$called = false;
$mustNotPost = static function () use (&$called): array {
    $called = true;
    return ['ok' => true, 'status' => 200, 'body' => '{"success":true}'];
};
$emptyToken = mt_turnstile_verify($secretEnv, '  ', '203.0.113.9', $mustNotPost);
expect($emptyToken['ok'] === false, 'empty token not ok');
expect((int) $emptyToken['status'] === 400, 'empty token 400');
expect($emptyToken['error'] === 'Vérification anti-robot requise.', 'empty token message');
expect($called === false, 'empty token skips siteverify');

$ok = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', $okPost);
expect($ok['ok'] === true, 'success true ok');
expect((int) $ok['status'] === 200, 'success true status 200');
expect(empty($ok['skipped']), 'success not skipped');

$denied = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => true, 'status' => 200, 'body' => '{"success":false}'];
});
expect($denied['ok'] === false, 'success false not ok');
expect((int) $denied['status'] === 400, 'success false 400');
expect($denied['error'] === 'Vérification anti-robot échouée, réessaie.', 'success false message');

$timeout = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => false, 'status' => 0, 'body' => ''];
});
expect($timeout['ok'] === true, 'timeout skips captcha');
expect(!empty($timeout['skipped']), 'timeout skipped flag');

$http500 = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => false, 'status' => 500, 'body' => '{"success":true}'];
});
expect($http500['ok'] === true, 'http 500 skips captcha');
expect(!empty($http500['skipped']), 'http 500 skipped flag');

$http429 = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => false, 'status' => 429, 'body' => ''];
});
expect($http429['ok'] === true, 'http 429 quota skips captcha');
expect(!empty($http429['skipped']), 'http 429 skipped flag');

$badJson = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => true, 'status' => 200, 'body' => 'not-json'];
});
expect($badJson['ok'] === true, 'invalid json skips captcha');
expect(!empty($badJson['skipped']), 'invalid json skipped flag');

$deadSecret = mt_turnstile_verify($secretEnv, 'tok', '203.0.113.9', static function (): array {
    return ['ok' => true, 'status' => 200, 'body' => '{"success":false,"error-codes":["invalid-input-secret"]}'];
});
expect($deadSecret['ok'] === true, 'invalid secret skips captcha');
expect(!empty($deadSecret['skipped']), 'invalid secret skipped flag');

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
