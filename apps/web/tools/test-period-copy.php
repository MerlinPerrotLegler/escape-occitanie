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

function cleanup_days(PDO $pdo, array $dates): void {
    foreach ($dates as $date) {
        $pdo->prepare('DELETE FROM bookings WHERE booking_date = ?')->execute([$date]);
        $pdo->prepare('DELETE FROM opening_periods WHERE period_date = ?')->execute([$date]);
        if (function_exists('mt_table_exists') && mt_table_exists($pdo, 'closed_slots')) {
            $pdo->prepare('DELETE FROM closed_slots WHERE slot_date = ?')->execute([$date]);
        }
    }
}

$env = mt_boot();
$pdo = mt_pdo($env);
mt_ensure_schema($pdo);

$src = '2099-07-10';
$empty = '2099-07-11';
$busy = '2099-07-12';
cleanup_days($pdo, [$src, $empty, $busy]);

try {
    $source = mt_add_period($pdo, $src, 600, 840); // 10:00–14:00
    mt_set_slot_kind($pdo, 'directeur', $src, 660, 'hidden'); // 11:00
    mt_set_slot_kind($pdo, 'vaisseau', $src, 720, 'closed'); // 12:00

    $missing = mt_copy_period($pdo, 0, [$empty], false);
    expect(($missing['ok'] ?? true) === false && ($missing['error'] ?? '') === 'not_found', 'missing source');

    $copied = mt_copy_period($pdo, (int) $source['id'], [$empty], false);
    expect(($copied['ok'] ?? false) === true && (int) $copied['copied'] === 1, 'copy to empty day');
    $periods = mt_periods_for_date($pdo, $empty);
    expect(count($periods) === 1 && (int) $periods[0]['start_minute'] === 600 && (int) $periods[0]['end_minute'] === 840, 'hours copied');
    expect((mt_slot_flags_for($pdo, 'directeur', $empty)[660] ?? '') === 'hidden', 'directeur hidden copied');
    expect((mt_slot_flags_for($pdo, 'vaisseau', $empty)[720] ?? '') === 'closed', 'vaisseau closed copied');

    mt_add_period($pdo, $busy, 600, 1320);
    $conflict = mt_copy_period($pdo, (int) $source['id'], [$busy], false);
    expect(($conflict['ok'] ?? true) === false && in_array($busy, $conflict['dates'] ?? [], true), '409-style conflict');
    expect(count(mt_periods_for_date($pdo, $busy)) === 1 && (int) mt_periods_for_date($pdo, $busy)[0]['end_minute'] === 1320, 'no write on conflict');

    $booking = mt_create_booking($pdo, [
        'room_slug' => 'directeur',
        'booking_date' => $busy,
        'start_minute' => 660,
        'guest_name' => 'Keep Me',
        'guest_email' => 'keep@example.com',
        'guest_phone' => '0600000099',
        'players' => 4,
    ]);
    $over = mt_copy_period($pdo, (int) $source['id'], [$busy], true);
    expect(($over['ok'] ?? false) === true, 'overwrite succeeds');
    expect(count(mt_periods_for_date($pdo, $busy)) === 1 && (int) mt_periods_for_date($pdo, $busy)[0]['end_minute'] === 840, 'one copied period');
    $kept = mt_get_booking($pdo, (int) $booking['id']);
    expect($kept && $kept['status'] !== 'cancelled', 'booking kept');
    $dirFlags = mt_slot_flags_for($pdo, 'directeur', $busy);
    expect(!isset($dirFlags[660]), 'do not flag occupied unit');
    expect((mt_slot_flags_for($pdo, 'vaisseau', $busy)[720] ?? '') === 'closed', 'unoccupied flag still copied');
} finally {
    cleanup_days($pdo, [$src, $empty, $busy]);
}

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
