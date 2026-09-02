<?php
declare(strict_types=1);

require dirname(__DIR__) . '/public/api/lib/schedule.php';

$failed = 0;
function expect($cond, $msg) {
    global $failed;
    if (!$cond) {
        fwrite(STDERR, "FAIL: $msg\n");
        $failed++;
    }
}

expect(mt_hhmm_to_minutes('10:00') === 600, '10:00 → 600');
expect(mt_hhmm_to_minutes('14:30') === 870, '14:30 → 870');
expect(mt_hhmm_to_minutes('25:00') === null, 'invalid hour rejected');
expect(mt_minutes_to_hhmm(870) === '14:30', '870 → 14:30');
expect(mt_is_slot_aligned(840) === true, '14:00 aligned');
expect(mt_is_slot_aligned(845) === false, '14:05 not aligned');

$minutes = mt_period_slot_minutes(600, 840);
expect($minutes[0] === 600, 'period first 30-min slot 10:00');
expect(end($minutes) === 810, 'period last 30-min slot 13:30');
expect(!in_array(840, $minutes, true), '14:00 is the period end, not a slot');
$shortPeriod = [['start_minute' => 600, 'end_minute' => 840]];
expect(mt_slot_unit_in_periods($shortPeriod, 810) === true, '13:30 unit inside 10:00–14:00');
expect(mt_game_fits_periods($shortPeriod, 780) === true, '13:00 game fits');
expect(mt_game_fits_periods($shortPeriod, 810) === false, '13:30 game does not fit');

$periods = [['start_minute' => 600, 'end_minute' => 1320]]; // 10:00–22:00
$slots = mt_compute_day_slots($periods, []);
$times = array_column($slots, 'time');
expect($times[0] === '10:00', 'first start 10:00');
expect(end($times) === '21:00', 'last start 21:00 so 60 min game fits before 22:00');
expect(!in_array('21:30', $times, true), '21:30 cannot fit 60 min before 22:00');
expect(count(array_filter($slots, fn($s) => $s['status'] === 'open')) === count($slots), 'all open without bookings');

$booked = mt_compute_day_slots($periods, [['start_minute' => 780, 'duration_minutes' => 60, 'status' => 'confirmed']]); // 13:00–14:00
$byTime = [];
foreach ($booked as $s) {
    $byTime[$s['time']] = $s['status'];
}
expect($byTime['13:00'] === 'reserved', '13:00 reserved by the 60-min game');
expect($byTime['13:30'] === 'closed', '13:30 closed (following unit of the game)');
expect($byTime['12:30'] === 'open', '12:30 stays open — the game does not occupy that unit');
expect($byTime['12:00'] === 'open', '12:00 open before the game');
expect($byTime['14:00'] === 'open', '14:00 open after the game');

$pending = mt_compute_day_slots($periods, [['start_minute' => 780, 'duration_minutes' => 30, 'status' => 'pending']]);
$pendingBy = [];
foreach ($pending as $s) {
    $pendingBy[$s['time']] = $s['status'];
}
expect($pendingBy['13:00'] === 'reserved', 'pending 13:00 reserves the 13:00 unit');
expect($pendingBy['12:30'] === 'open', 'pending 13:00 does not occupy 12:30');
expect($pendingBy['13:30'] === 'open', 'stored 30-min duration occupies only the start unit');
expect($pendingBy['12:00'] === 'open', '12:00 still open with pending 13:00');
expect(mt_occupancy_duration(['status' => 'pending', 'duration_minutes' => 30]) === 30, 'stored 30-min duration is trusted');
expect(mt_occupancy_duration(['status' => 'pending', 'duration_minutes' => 0]) === 60, 'missing duration falls back to occupancy settings');

$closed = mt_compute_day_slots($periods, [], [780]);
$closedBy = [];
foreach ($closed as $s) {
    $closedBy[$s['time']] = $s['status'];
}
expect($closedBy['13:00'] === 'closed', 'maître can close the 13:00 start');
expect($closedBy['12:30'] === 'open', 'closing 13:00 does not close 12:30');
expect($closedBy['13:30'] === 'open', 'closing 13:00 does not close 13:30');

$hidden = mt_compute_day_slots($periods, [], [780 => 'hidden']);
$hiddenBy = [];
foreach ($hidden as $s) {
    $hiddenBy[$s['time']] = $s['status'];
}
expect($hiddenBy['13:00'] === 'hidden', 'maître can hide the 13:00 start');
expect($hiddenBy['13:30'] === 'open', 'hiding 13:00 does not hide 13:30');
$publicVisible = mt_filter_public_slots($hidden);
$publicTimes = array_column($publicVisible, 'time');
expect(!in_array('13:00', $publicTimes, true), 'hidden 13:00 is omitted from the public list');
expect(in_array('13:30', $publicTimes, true), 'open 13:30 stays on the public list');
$publicClosed = mt_filter_public_slots($closed);
expect(in_array('13:00', array_column($publicClosed, 'time'), true), 'closed 13:00 stays visible to the public');

expect(mt_next_admin_slot_status('open') === 'hidden', 'cycle open → hidden');
expect(mt_next_admin_slot_status('hidden') === 'closed', 'cycle hidden → closed');
expect(mt_next_admin_slot_status('closed') === 'open', 'cycle closed → open');
expect(mt_next_admin_slot_status('reserved') === null, 'cycle skips reserved');

$bookedClosed = mt_compute_day_slots(
    $periods,
    [['start_minute' => 780, 'duration_minutes' => 60, 'status' => 'confirmed']],
    [780]
);
$bookedClosedBy = [];
foreach ($bookedClosed as $s) {
    $bookedClosedBy[$s['time']] = $s['status'];
}
expect($bookedClosedBy['13:00'] === 'reserved', 'a booking wins over a closed flag on the same unit');
expect($bookedClosedBy['13:30'] === 'closed', 'second unit of the game appears closed');

$units = mt_compute_unit_slots($periods, [], [810]);
$unitBy = [];
foreach ($units as $s) {
    $unitBy[$s['time']] = $s['status'];
}
expect($unitBy['10:00'] === 'open', 'first 30-min unit is open');
expect($unitBy['13:30'] === 'closed', 'maître can close a 30-min unit that is not a 60-min start');
$unitTimes = array_column($units, 'time');
expect(end($unitTimes) === '21:30', 'unit grid last block is 21:30–22:00');

$periodUnits = mt_compute_unit_slots([['start_minute' => 600, 'end_minute' => 840]], [], []);
$periodTimes = array_column($periodUnits, 'time');
expect($periodTimes[0] === '10:00', 'unit grid starts at period start');
expect(end($periodTimes) === '13:30', 'unit grid includes the last 30 min before period end');

expect(mt_ranges_overlap(840, 30, 840, 30) === true, 'same 30-min overlaps');
expect(mt_ranges_overlap(840, 30, 870, 30) === false, 'adjacent 30-min do not overlap');
expect(mt_ranges_overlap(810, 60, 840, 60) === true, '13:30–14:30 overlaps 14:00–15:00');
expect(mt_ranges_overlap(780, 60, 840, 60) === false, '13:00–14:00 does not overlap 14:00–15:00');
expect(mt_ranges_overlap(840, 30, 840, 60) === true, 'pending 14:00 overlaps confirmed 14:00–15:00');
expect(mt_ranges_overlap(870, 60, 840, 30) === false, '14:30–15:30 does not overlap pending 14:00–14:30');

$empty = mt_compute_day_slots([], []);
expect($empty === [], 'no periods → no slots');

$alice = ['id' => 7, 'start_minute' => 780, 'duration_minutes' => 60, 'status' => 'confirmed', 'guest_name' => 'Alice'];
$annotated = mt_annotate_reserved_slots(mt_compute_unit_slots($periods, [$alice]), [$alice]);
$annotatedBy = [];
foreach ($annotated as $s) {
    $annotatedBy[$s['time']] = $s;
}
expect(($annotatedBy['13:00']['guest_name'] ?? '') === 'Alice', 'reserved 13:00 shows guest name');
expect((int) ($annotatedBy['13:00']['booking_id'] ?? 0) === 7, 'reserved 13:00 links to booking id');
expect(($annotatedBy['13:30']['status'] ?? '') === 'closed', 'following unit appears closed on the reserved room');
expect(($annotatedBy['13:30']['guest_name'] ?? null) === null, 'following unit does not show the guest name');
expect((int) ($annotatedBy['13:30']['booking_id'] ?? 0) === 7, 'following unit still links to the booking');
expect(($annotatedBy['12:30']['guest_name'] ?? null) === null, 'open slot has no guest name');
expect(($annotatedBy['12:30']['booking_id'] ?? null) === null, 'open slot has no booking id');

$aliceDirecteur = ['id' => 7, 'room_slug' => 'directeur', 'start_minute' => 780, 'duration_minutes' => 60, 'status' => 'confirmed', 'guest_name' => 'Alice'];
$otherRoomUnits = mt_annotate_reserved_slots(
    mt_compute_unit_slots($periods, [$aliceDirecteur], [], 'vaisseau'),
    [$aliceDirecteur]
);
$otherBy = [];
foreach ($otherRoomUnits as $s) {
    $otherBy[$s['time']] = $s;
}
expect(($otherBy['13:00']['status'] ?? '') === 'closed', 'other room start appears closed');
expect(($otherBy['13:30']['status'] ?? '') === 'closed', 'other room following unit appears closed');
expect(($otherBy['13:00']['guest_name'] ?? null) === null, 'other room does not show the guest name');
expect((int) ($otherBy['13:00']['booking_id'] ?? 0) === 7, 'other room closed unit still links to the booking');
$sameRoomUnits = mt_annotate_reserved_slots(
    mt_compute_unit_slots($periods, [$aliceDirecteur], [], 'directeur'),
    [$aliceDirecteur]
);
$sameBy = [];
foreach ($sameRoomUnits as $s) {
    $sameBy[$s['time']] = $s;
}
expect(($sameBy['13:00']['status'] ?? '') === 'reserved', 'reserved room start stays reserved');
expect(($sameBy['13:00']['guest_name'] ?? '') === 'Alice', 'reserved room start shows the guest name');
expect(($sameBy['13:30']['status'] ?? '') === 'closed', 'reserved room following unit is closed');
$pendingBob = ['id' => 9, 'start_minute' => 780, 'duration_minutes' => 30, 'status' => 'pending', 'guest_name' => 'Bob'];
$pendingAnnotated = mt_annotate_reserved_slots(mt_compute_unit_slots($periods, [$pendingBob]), [$pendingBob]);
$pendingBy = [];
foreach ($pendingAnnotated as $s) {
    $pendingBy[$s['time']] = $s;
}
expect(($pendingBy['13:00']['guest_name'] ?? '') === 'Bob', 'pending occupies the start unit');
expect(($pendingBy['13:30']['guest_name'] ?? null) === null, '30-min pending does not name the following unit');

mt_set_runtime_booking_settings(['slot_minutes' => 15, 'block_next_slot' => false]);
expect(mt_slot_minutes() === 15, 'runtime slot minutes 15');
expect(mt_occupancy_minutes() === 15, 'occupancy is one 15-min slot when next is not blocked');
expect(mt_is_slot_aligned(615) === true, '10:15 aligned on 15-min slots');
$fine = mt_compute_day_slots($periods, []);
$fineTimes = array_column($fine, 'time');
expect($fineTimes[0] === '10:00', '15-min grid starts at 10:00');
expect(end($fineTimes) === '21:45', 'last 15-min start is 21:45');
expect(in_array('10:15', $fineTimes, true), '10:15 is a public start');
mt_set_runtime_booking_settings(['slot_minutes' => 30, 'block_next_slot' => false]);
expect(mt_occupancy_minutes() === 30, 'occupancy is 30 when next slot is not blocked');
$noBuffer = mt_compute_day_slots($periods, [['start_minute' => 780, 'duration_minutes' => 30]]);
$noBufferBy = [];
foreach ($noBuffer as $s) {
    $noBufferBy[$s['time']] = $s['status'];
}
expect($noBufferBy['13:00'] === 'reserved', '30-min occupancy reserves 13:00');
expect($noBufferBy['13:30'] === 'open', '30-min occupancy leaves 13:30 open');
mt_set_runtime_booking_settings(mt_default_booking_settings());
expect(mt_occupancy_minutes() === 60, 'defaults restore 60-min occupancy');

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
