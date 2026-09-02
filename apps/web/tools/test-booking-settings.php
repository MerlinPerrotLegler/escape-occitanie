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

function cleanup_settings_day(PDO $pdo, string $date): void {
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
$date = '2099-07-21';
cleanup_settings_day($pdo, $date);
$createdIds = [];

try {
    $normalized = mt_normalize_booking_settings([
        'block_both_rooms' => '1',
        'block_next_slot' => '0',
        'slot_minutes' => 15,
        'auto_confirm' => true,
    ]);
    expect($normalized['block_both_rooms'] === true, 'normalize both rooms');
    expect($normalized['block_next_slot'] === false, 'normalize next slot off');
    expect($normalized['slot_minutes'] === 15, 'normalize 15-min slots');
    expect($normalized['auto_confirm'] === true, 'normalize auto confirm');
    expect($normalized['occupancy_minutes'] === 15, 'occupancy follows slot when next is off');
    expect(mt_normalize_booking_settings(['slot_minutes' => 12])['slot_minutes'] === 30, 'invalid slot rejected');

    mt_save_booking_settings($pdo, mt_default_booking_settings());
    $defaults = mt_get_booking_settings($pdo);
    expect($defaults['slot_minutes'] === 30, 'default slot 30');
    expect($defaults['block_next_slot'] === true, 'default blocks next slot');
    expect($defaults['occupancy_minutes'] === 60, 'default occupancy 60');
    expect($defaults['auto_confirm'] === false, 'default manual confirm');
    expect($defaults['block_both_rooms'] === false, 'default one room');

    mt_add_period($pdo, $date, 600, 840);
    $booking = mt_create_booking($pdo, [
        'room_slug' => 'directeur',
        'booking_date' => $date,
        'start_minute' => 600,
        'guest_name' => 'Both Rooms',
        'guest_email' => 'both-rooms@example.com',
        'guest_phone' => '0600000099',
        'players' => 4,
    ]);
    $createdIds[] = (int) $booking['id'];
    $otherOpen = array_column(
        array_filter(mt_public_day_slots($pdo, 'vaisseau', $date), fn($s) => $s['status'] === 'open'),
        'minute'
    );
    expect(in_array(600, $otherOpen, true), 'other room stays open without the setting');

    mt_save_booking_settings($pdo, ['block_both_rooms' => true, 'block_next_slot' => true, 'slot_minutes' => 30]);
    $otherBlocked = [];
    foreach (mt_public_day_slots($pdo, 'vaisseau', $date) as $slot) {
        $otherBlocked[$slot['minute']] = $slot['status'];
    }
    expect(($otherBlocked[600] ?? '') === 'reserved', 'blocking both rooms occupies the other salle');
    expect(($otherBlocked[630] ?? '') === 'reserved', 'blocking both rooms occupies the following slot too');
    expect(mt_find_open_game_slot($pdo, 'vaisseau', $date, 600) === null, 'cannot book the other room over a shared reservation');

    mt_cancel_booking($pdo, (int) $booking['id']);
    mt_save_booking_settings($pdo, ['auto_confirm' => true, 'slot_minutes' => 30, 'block_next_slot' => true]);
    $auto = mt_create_booking($pdo, [
        'room_slug' => 'directeur',
        'booking_date' => $date,
        'start_minute' => 660,
        'guest_name' => 'Auto Confirm',
        'guest_email' => 'auto-confirm@example.com',
        'guest_phone' => '0600000098',
        'players' => 3,
    ]);
    $createdIds[] = (int) $auto['id'];
    expect($auto['status'] === 'confirmed', 'auto confirm creates a confirmed booking');

    mt_save_booking_settings($pdo, mt_default_booking_settings());
    $today = mt_today_paris();
    $pending = mt_create_booking($pdo, [
        'room_slug' => 'directeur',
        'booking_date' => $today,
        'start_minute' => 600,
        'guest_name' => 'Today Pending SettingsTest',
        'guest_email' => 'today-pending-settings-test@example.com',
        'guest_phone' => '0600000097',
        'players' => 4,
        'status' => 'pending',
    ]);
    $createdIds[] = (int) $pending['id'];
    $page = mt_list_bookings_page($pdo, 'aujourdhui', 1);
    $foundToday = false;
    for ($p = 1; $p <= (int) $page['pages']; $p++) {
        $chunk = $p === 1 ? $page : mt_list_bookings_page($pdo, 'aujourdhui', $p);
        foreach ($chunk['bookings'] as $row) {
            if ((int) $row['id'] === (int) $pending['id']) {
                $foundToday = true;
                break 2;
            }
        }
    }
    expect($foundToday, 'today filter includes today booking');
    expect($page['filtre'] === 'aujourdhui', 'today filter echoed');
    $toConfirm = mt_list_bookings_page($pdo, 'a-confirmer', 1);
    $foundPending = false;
    $foundAuto = false;
    for ($p = 1; $p <= (int) $toConfirm['pages']; $p++) {
        $chunk = $p === 1 ? $toConfirm : mt_list_bookings_page($pdo, 'a-confirmer', $p);
        foreach ($chunk['bookings'] as $row) {
            if ((int) $row['id'] === (int) $pending['id']) {
                $foundPending = true;
            }
            if ((int) $row['id'] === (int) $auto['id']) {
                $foundAuto = true;
            }
        }
    }
    expect($foundPending, 'à confirmer includes pending');
    expect(!$foundAuto, 'à confirmer excludes already confirmed');
    expect(isset($toConfirm['pendingCount']), 'list payload includes pendingCount');
    expect((int) $toConfirm['pendingCount'] >= 1, 'pendingCount counts the pending booking');
    $counted = mt_pending_booking_count($pdo);
    expect($counted === (int) $toConfirm['pendingCount'], 'pendingCount helper matches list payload');
    $focused = mt_list_bookings_page($pdo, 'toutes', 1, (int) $auto['id']);
    $focusIds = array_map(fn($row) => (int) $row['id'], $focused['bookings']);
    expect(in_array((int) $auto['id'], $focusIds, true), 'focus jumps to the page that contains the booking');
} finally {
    foreach ($createdIds as $id) {
        $pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([$id]);
    }
    cleanup_settings_day($pdo, $date);
    mt_save_booking_settings($pdo, $savedSettings);
}

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
