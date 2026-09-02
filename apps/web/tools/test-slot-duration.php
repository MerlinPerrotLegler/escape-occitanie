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
    if (function_exists('mt_table_exists') && mt_table_exists($pdo, 'closed_slots')) {
        $pdo->prepare('DELETE FROM closed_slots WHERE slot_date = ?')->execute([$date]);
    }
}

$env = mt_boot();
$pdo = mt_pdo($env);
mt_ensure_schema($pdo);
$savedSettings = mt_get_booking_settings($pdo);
mt_save_booking_settings($pdo, mt_default_booking_settings());

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
    expect((int) $booking['duration_minutes'] === 60, 'pending occupies 60 min');

    $byMinute = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $byMinute[$slot['minute']] = $slot['status'];
    }
    expect(($byMinute[600] ?? '') === 'reserved', '10:00 reserved while pending');
    expect(($byMinute[630] ?? '') === 'reserved', '10:30 reserved while 10:00 is pending');
    expect(mt_find_open_game_slot($pdo, $room, $date, 630) === null, 'public cannot book 10:30 over a 10:00 reservation');

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
    expect((int) ($moved['ics_sequence'] ?? 0) === 1, 'moving a booking bumps ics sequence');
    $nameOnly = mt_update_booking($pdo, (int) $booking['id'], ['guest_name' => 'Moved Name']);
    expect((int) ($nameOnly['ics_sequence'] ?? 0) === 1, 'contact-only update keeps ics sequence');
    expect($nameOnly['guest_name'] === 'Moved Name', 'contact-only update still saves the name');
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

    mt_add_period($pdo, $date, 600, 960); // 10:00–16:00 so 13:30 is a public start

    $thirteen = mt_create_booking($pdo, [
        'room_slug' => $room,
        'booking_date' => $date,
        'start_minute' => 780,
        'guest_name' => 'Thirteen',
        'guest_email' => 'thirteen@example.com',
        'guest_phone' => '0600000004',
        'players' => 4,
    ]);
    $confirmedThirteen = mt_confirm_booking($pdo, (int) $thirteen['id']);
    expect($confirmedThirteen && $confirmedThirteen['status'] === 'confirmed', '13:00 confirm succeeds');
    $atThirteen = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $atThirteen[$slot['minute']] = $slot['status'];
    }
    expect(($atThirteen[780] ?? '') === 'reserved', '13:00 reserved');
    expect(($atThirteen[810] ?? '') === 'reserved', '13:30 reserved with the 13:00 game');
    expect(($atThirteen[750] ?? '') === 'open', '12:30 stays open when 13:00 is booked');
    mt_cancel_booking($pdo, (int) $thirteen['id']);

    $closed = mt_close_slot($pdo, $room, $date, 780);
    expect($closed['start_minute'] === 780, 'close 13:00 returns the unit');
    $afterMaitreClose = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $afterMaitreClose[$slot['minute']] = $slot['status'];
    }
    expect(($afterMaitreClose[780] ?? '') === 'closed', 'closed 13:00 is unavailable publicly');
    expect(($afterMaitreClose[750] ?? '') === 'open', '12:30 stays open after closing 13:00');
    expect(mt_find_open_game_slot($pdo, $room, $date, 780) === null, 'cannot book a closed start');

    $admin = [];
    foreach (mt_admin_day_slots($pdo, $room, $date) as $slot) {
        $admin[$slot['minute']] = $slot['status'];
    }
    expect(($admin[780] ?? '') === 'closed', 'admin grid shows 13:00 closed');
    expect(($admin[810] ?? '') === 'open', 'admin grid still has the 13:30 unit');

    $pendingOnClosedFollow = mt_create_booking($pdo, [
        'room_slug' => $room,
        'booking_date' => $date,
        'start_minute' => 750,
        'guest_name' => 'Needs Follow',
        'guest_email' => 'needs-follow@example.com',
        'guest_phone' => '0600000005',
        'players' => 3,
    ]);
    $warnClosedFollow = null;
    try {
        mt_confirm_booking($pdo, (int) $pendingOnClosedFollow['id']);
    } catch (RuntimeException $e) {
        $warnClosedFollow = $e->getMessage();
    }
    expect($warnClosedFollow !== null && str_contains($warnClosedFollow, '13:00'), 'confirm fails when the following unit is closed');
    mt_cancel_booking($pdo, (int) $pendingOnClosedFollow['id']);

    expect(mt_open_slot($pdo, $room, $date, 780) === true, 'reopen 13:00');
    $reopened = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $reopened[$slot['minute']] = $slot['status'];
    }
    expect(($reopened[780] ?? '') === 'open', '13:00 open after reopen');

    $hidden = mt_set_slot_kind($pdo, $room, $date, 780, 'hidden');
    expect(($hidden['kind'] ?? '') === 'hidden', 'hide 13:00 stores hidden kind');
    $afterHide = [];
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $afterHide[$slot['minute']] = $slot['status'];
    }
    expect(!array_key_exists(780, $afterHide), 'hidden 13:00 is omitted from public slots');
    expect(($afterHide[750] ?? '') === 'open', '12:30 stays listed after hiding 13:00');
    $adminHidden = [];
    foreach (mt_admin_day_slots($pdo, $room, $date) as $slot) {
        $adminHidden[$slot['minute']] = $slot['status'];
    }
    expect(($adminHidden[780] ?? '') === 'hidden', 'admin grid shows 13:00 as hidden');
    expect(mt_find_open_game_slot($pdo, $room, $date, 780) === null, 'cannot book a hidden start');
    expect(mt_set_slot_kind($pdo, $room, $date, 780, 'closed')['kind'] === 'closed', 'hidden can become closed');
    expect(mt_open_slot($pdo, $room, $date, 780) === true, 'reopen hidden/closed 13:00');

    $busy = mt_create_booking($pdo, [
        'room_slug' => $room,
        'booking_date' => $date,
        'start_minute' => 780,
        'guest_name' => 'Busy Close',
        'guest_email' => 'busy-close@example.com',
        'guest_phone' => '0600000006',
        'players' => 3,
    ]);
    $warnBusyClose = null;
    try {
        mt_close_slot($pdo, $room, $date, 780);
    } catch (RuntimeException $e) {
        $warnBusyClose = $e->getMessage();
    }
    expect($warnBusyClose !== null, 'cannot close a reserved unit');
    mt_cancel_booking($pdo, (int) $busy['id']);

    $otherRoom = [];
    mt_close_slot($pdo, 'vaisseau', $date, 780);
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        $otherRoom[$slot['minute']] = $slot['status'];
    }
    expect(($otherRoom[780] ?? '') === 'open', 'closing a slot on the other room does not close this room');
} finally {
    cleanup_test_day($pdo, $date);
}

$editDate = '2099-06-16';
$movedDate = '2099-06-17';
cleanup_test_day($pdo, $editDate);
cleanup_test_day($pdo, $movedDate);
try {
    $created = mt_add_period($pdo, $editDate, 600, 840);
    $updated = mt_update_period($pdo, (int) $created['id'], $movedDate, 660, 900);
    expect($updated !== null, 'update returns the period');
    expect($updated['period_date'] === $movedDate, 'update can move the date');
    expect($updated['start'] === '11:00', 'update start to 11:00');
    expect($updated['end'] === '15:00', 'update end to 15:00');
    expect(mt_update_period($pdo, 0, $movedDate, 600, 840) === null, 'missing id returns null');

    $movedOpen = array_column(
        array_filter(mt_public_day_slots($pdo, $room, $movedDate), fn($s) => $s['status'] === 'open'),
        'minute'
    );
    expect(in_array(660, $movedOpen, true), '11:00 is open after update');
    expect(!in_array(600, $movedOpen, true), '10:00 is gone after the period moved');
} finally {
    cleanup_test_day($pdo, $editDate);
    cleanup_test_day($pdo, $movedDate);
}

mt_save_booking_settings($pdo, $savedSettings);

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
