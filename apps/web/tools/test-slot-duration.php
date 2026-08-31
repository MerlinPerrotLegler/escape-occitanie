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

function cleanup_test_day(PDO $pdo, string $date): void {
    $pdo->prepare('DELETE FROM bookings WHERE booking_date = ?')->execute([$date]);
    $pdo->prepare('DELETE FROM opening_periods WHERE period_date = ?')->execute([$date]);
}

$env = mt_boot();
$pdo = mt_pdo($env);
mt_ensure_schema($pdo);

$date = '2099-06-15';
$room = 'directeur';
cleanup_test_day($pdo, $date);

try {
    mt_add_period($pdo, $date, 600, 840); // 10:00–14:00

    $public = mt_public_day_slots($pdo, $room, $date);
    $open = array_column(array_filter($public, fn($s) => $s['status'] === 'open'), 'minute');
    expect(in_array(600, $open, true), '10:00 is an open 60-min start');
    expect(in_array(630, $open, true), '10:30 is an open 60-min start');
    expect(!in_array(810, $open, true), '13:30 cannot fit 60 min before 14:00');

    $booking = mt_create_booking($pdo, [
        'room_slug' => $room,
        'booking_date' => $date,
        'start_minute' => 600,
        'guest_name' => 'Test Duration',
        'guest_email' => 'duration-test@example.com',
        'guest_phone' => '0600000000',
        'players' => 4,
    ]);
    expect($booking['status'] === 'pending', 'created pending');
    expect((int) $booking['duration_minutes'] === 30, 'pending occupies 30 min');

    $byMinute = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $byMinute[$slot['minute']] = $slot['status'];
    }
    expect(($byMinute[600] ?? '') === 'reserved', '10:00 reserved while pending');
    expect(($byMinute[630] ?? '') === 'open', '10:30 remains bookable while 10:00 is pending');

    $confirmed = mt_confirm_booking($pdo, (int) $booking['id']);
    expect($confirmed && $confirmed['status'] === 'confirmed', 'confirm succeeds when next 30 min is free');
    expect((int) $confirmed['duration_minutes'] === 60, 'confirmed occupies 60 min');

    $afterConfirm = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $afterConfirm[$slot['minute']] = $slot['status'];
    }
    expect(($afterConfirm[600] ?? '') === 'reserved', '10:00 reserved once confirmed');
    expect(($afterConfirm[630] ?? '') === 'reserved', '10:30 reserved by the 60-min game');
    expect(($afterConfirm[660] ?? '') === 'open', '11:00 open after the game');

    $busyStart = mt_create_booking($pdo, [
        'room_slug' => $room,
        'booking_date' => $date,
        'start_minute' => 660,
        'guest_name' => 'Busy Start',
        'guest_email' => 'busy-start@example.com',
        'guest_phone' => '0600000001',
        'players' => 3,
    ]);
    $busyNext = mt_create_booking($pdo, [
        'room_slug' => $room,
        'booking_date' => $date,
        'start_minute' => 690,
        'guest_name' => 'Busy Next',
        'guest_email' => 'busy-next@example.com',
        'guest_phone' => '0600000002',
        'players' => 3,
    ]);
    $warnBusy = null;
    try {
        mt_confirm_booking($pdo, (int) $busyStart['id']);
    } catch (RuntimeException $e) {
        $warnBusy = $e->getMessage();
    }
    expect($warnBusy !== null && str_contains($warnBusy, '11:30'), 'confirm warns when the following 30 min is taken');
    expect(mt_get_booking($pdo, (int) $busyStart['id'])['status'] === 'pending', 'failed confirm stays pending');
    mt_cancel_booking($pdo, (int) $busyStart['id']);
    mt_cancel_booking($pdo, (int) $busyNext['id']);

    $tail = mt_create_booking($pdo, [
        'room_slug' => $room,
        'booking_date' => $date,
        'start_minute' => 810,
        'guest_name' => 'No Following',
        'guest_email' => 'no-following@example.com',
        'guest_phone' => '0600000003',
        'players' => 3,
    ]);
    $warnMissing = null;
    try {
        mt_confirm_booking($pdo, (int) $tail['id']);
    } catch (RuntimeException $e) {
        $warnMissing = $e->getMessage();
    }
    expect($warnMissing !== null && str_contains($warnMissing, '14:00'), 'confirm warns when 60 min does not fit the period');
    mt_cancel_booking($pdo, (int) $tail['id']);

    $moved = mt_update_booking($pdo, (int) $booking['id'], ['date' => $date, 'time' => '12:00']);
    expect((int) $moved['start_minute'] === 720, '60-min booking moved to 12:00');
    expect((int) $moved['duration_minutes'] === 60, 'moved booking stays 60 min');
    $afterMove = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $afterMove[$slot['minute']] = $slot['status'];
    }
    expect(($afterMove[600] ?? '') === 'open', 'origin 10:00 is free after the move');
    expect(($afterMove[630] ?? '') === 'open', 'origin 10:30 is free after the move');
    expect(($afterMove[720] ?? '') === 'reserved', '12:00 reserved after the move');
    expect(($afterMove[750] ?? '') === 'reserved', '12:30 reserved after the move');

    mt_cancel_booking($pdo, (int) $booking['id']);
    $afterCancel = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $afterCancel[$slot['minute']] = $slot['status'];
    }
    expect(($afterCancel[720] ?? '') === 'open', '12:00 open after cancel');
    expect(($afterCancel[750] ?? '') === 'open', '12:30 open after cancel');
} finally {
    cleanup_test_day($pdo, $date);
}

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
