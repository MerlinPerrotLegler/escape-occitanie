<?php
declare(strict_types=1);

const MT_TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MT_TURNSTILE_UNAVAILABLE = 'Réservation temporairement indisponible.';
const MT_TURNSTILE_REQUIRED = 'Vérification anti-robot requise.';
const MT_TURNSTILE_FAILED = 'Vérification anti-robot échouée, réessaie.';

function mt_turnstile_result(bool $ok, int $status, string $error = '', bool $skipped = false): array {
    return ['ok' => $ok, 'status' => $status, 'error' => $error, 'skipped' => $skipped];
}

function mt_turnstile_skip(): array {
    return mt_turnstile_result(true, 200, '', true);
}

function mt_turnstile_configured(array $env): bool {
    $site = trim((string) ($env['TURNSTILE_SITE_KEY'] ?? ''));
    $secret = trim((string) ($env['TURNSTILE_SECRET_KEY'] ?? ''));
    return $site !== '' && $secret !== '';
}

function mt_turnstile_skip_error_codes(array $codes): bool {
    foreach ($codes as $code) {
        if (!is_string($code)) {
            continue;
        }
        if (in_array($code, ['invalid-input-secret', 'missing-input-secret', 'internal-error'], true)) {
            return true;
        }
    }
    return false;
}

function mt_turnstile_siteverify_post(string $url, array $fields): array {
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'status' => 0, 'body' => ''];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($fields),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT => 8,
        CURLOPT_USERAGENT => 'EscapeOccitanie/1.0',
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [
        'ok' => $raw !== false && $status === 200,
        'status' => $status,
        'body' => is_string($raw) ? $raw : '',
    ];
}

function mt_turnstile_verify(array $env, string $token, string $ip, ?callable $post = null): array {
    if (!mt_turnstile_configured($env) || ($post === null && !function_exists('curl_init'))) {
        return mt_turnstile_skip();
    }
    $token = trim($token);
    if ($token === '') {
        return mt_turnstile_result(false, 400, MT_TURNSTILE_REQUIRED);
    }
    $postFn = $post ?? 'mt_turnstile_siteverify_post';
    try {
        $res = $postFn(MT_TURNSTILE_VERIFY_URL, [
            'secret' => trim((string) ($env['TURNSTILE_SECRET_KEY'] ?? '')),
            'response' => $token,
            'remoteip' => $ip,
        ]);
    } catch (Throwable $e) {
        return mt_turnstile_skip();
    }
    $httpStatus = is_array($res) ? (int) ($res['status'] ?? 0) : 0;
    if (!is_array($res) || $httpStatus !== 200) {
        return mt_turnstile_skip();
    }
    $data = json_decode((string) ($res['body'] ?? ''), true);
    if (!is_array($data)) {
        return mt_turnstile_skip();
    }
    if (($data['success'] ?? false) === true) {
        return mt_turnstile_result(true, 200, '');
    }
    $codes = $data['error-codes'] ?? [];
    if (!is_array($codes)) {
        $codes = [];
    }
    if (mt_turnstile_skip_error_codes($codes)) {
        return mt_turnstile_skip();
    }
    return mt_turnstile_result(false, 400, MT_TURNSTILE_FAILED);
}
