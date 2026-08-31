<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/env.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/validate.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/schedule.php';
require_once __DIR__ . '/lib/booking.php';
require_once __DIR__ . '/lib/mail.php';
require_once __DIR__ . '/lib/calendar.php';

function mt_boot(): array {
    $env = mt_load_env(__DIR__);
    return $env;
}

function mt_require_session(array $env): array {
    $secret = $env['AUTH_SECRET'] ?? '';
    $session = mt_verify_cookie($_COOKIE[MT_COOKIE] ?? null, $secret);
    if (!$session) {
        mt_json_out(401, ['error' => 'Session expirée.']);
    }
    return $session;
}
