<?php
declare(strict_types=1);

$root = dirname(__DIR__) . '/public/api/lib';
require $root . '/env.php';
require $root . '/validate.php';
require $root . '/auth.php';

$failed = 0;
function expect($cond, $msg) {
    global $failed;
    if (!$cond) {
        fwrite(STDERR, "FAIL: $msg\n");
        $failed++;
    }
}

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

$ip = 'test-ip-' . bin2hex(random_bytes(4));
expect(mt_rate_limit_hit($ip) === false, 'first hit allowed');
for ($i = 0; $i < 4; $i++) {
    mt_rate_limit_hit($ip);
}
expect(mt_rate_limit_hit($ip) === true, '6th hit blocked');

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
$envCal = ['AUTH_SECRET' => 'test-secret-key-for-hmac', 'AUTH_URL' => 'http://localhost:3000'];
$token = mt_calendar_token($envCal, 42, 'paul@example.com');
expect(mt_calendar_token_ok($envCal, 42, 'paul@example.com', $token) === true, 'calendar token ok');
expect(mt_calendar_token_ok($envCal, 42, 'other@example.com', $token) === false, 'calendar token rejects other email');
$links = mt_booking_calendar_links($envCal, $booking);
expect(str_contains($links['ics'], '/api/calendar.php?b=42'), 'ics download link');
expect(str_contains($links['google'], 'calendar.google.com'), 'google calendar link');

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
