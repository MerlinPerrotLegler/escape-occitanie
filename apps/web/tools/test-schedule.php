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

$booked = mt_compute_day_slots($periods, [['start_minute' => 840]]); // 14:00 occupies 14:00–15:00
$byTime = [];
foreach ($booked as $s) {
    $byTime[$s['time']] = $s['status'];
}
expect($byTime['14:00'] === 'reserved', '14:00 reserved');
expect($byTime['14:30'] === 'reserved', '14:30 reserved (2nd slot of the game)');
expect($byTime['13:30'] === 'reserved', '13:30 overlaps the 14:00 game');
expect($byTime['13:00'] === 'open', '13:00–14:00 does not overlap 14:00–15:00');
expect($byTime['15:00'] === 'open', '15:00 open after the game');

$pending = mt_compute_day_slots($periods, [['start_minute' => 840, 'duration_minutes' => 30, 'status' => 'pending']]);
$pendingBy = [];
foreach ($pending as $s) {
    $pendingBy[$s['time']] = $s['status'];
}
expect($pendingBy['14:00'] === 'reserved', 'pending 14:00 reserves 14:00 start');
expect($pendingBy['13:30'] === 'reserved', 'pending 14:00 overlaps 13:30 start');
expect($pendingBy['14:30'] === 'open', 'pending 14:00 leaves 14:30 start open');
expect($pendingBy['13:00'] === 'open', '13:00 still open with pending 14:00');

expect(mt_ranges_overlap(840, 30, 840, 30) === true, 'same 30-min overlaps');
expect(mt_ranges_overlap(840, 30, 870, 30) === false, 'adjacent 30-min do not overlap');
expect(mt_ranges_overlap(810, 60, 840, 60) === true, '13:30–14:30 overlaps 14:00–15:00');
expect(mt_ranges_overlap(780, 60, 840, 60) === false, '13:00–14:00 does not overlap 14:00–15:00');
expect(mt_ranges_overlap(840, 30, 840, 60) === true, 'pending 14:00 overlaps confirmed 14:00–15:00');
expect(mt_ranges_overlap(870, 60, 840, 30) === false, '14:30–15:30 does not overlap pending 14:00–14:30');

$empty = mt_compute_day_slots([], []);
expect($empty === [], 'no periods → no slots');

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
