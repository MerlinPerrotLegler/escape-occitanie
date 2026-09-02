<?php
declare(strict_types=1);

const MT_SLOT_MINUTES = 30;
const MT_GAME_SLOTS = 2;
const MT_GAME_MINUTES = MT_SLOT_MINUTES * MT_GAME_SLOTS;
const MT_SLOT_MINUTE_OPTIONS = [15, 30, 60];
const MT_ROOM_SLUGS = ['directeur', 'vaisseau'];

function mt_default_booking_settings(): array {
    return [
        'block_both_rooms' => false,
        'block_next_slot' => true,
        'slot_minutes' => MT_SLOT_MINUTES,
        'auto_confirm' => false,
    ];
}

function mt_truthy($value): bool {
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (int) $value !== 0;
    }
    if (is_string($value)) {
        $v = strtolower(trim($value));
        return $v === '1' || $v === 'true' || $v === 'on' || $v === 'yes';
    }
    return !empty($value);
}

function mt_normalize_booking_settings(array $raw): array {
    $defaults = mt_default_booking_settings();
    $slot = (int) ($raw['slot_minutes'] ?? $defaults['slot_minutes']);
    if (!in_array($slot, MT_SLOT_MINUTE_OPTIONS, true)) {
        $slot = $defaults['slot_minutes'];
    }
    $blockNext = array_key_exists('block_next_slot', $raw)
        ? mt_truthy($raw['block_next_slot'])
        : $defaults['block_next_slot'];
    $blockBoth = array_key_exists('block_both_rooms', $raw)
        ? mt_truthy($raw['block_both_rooms'])
        : $defaults['block_both_rooms'];
    $auto = array_key_exists('auto_confirm', $raw)
        ? mt_truthy($raw['auto_confirm'])
        : $defaults['auto_confirm'];
    return [
        'block_both_rooms' => $blockBoth,
        'block_next_slot' => $blockNext,
        'slot_minutes' => $slot,
        'auto_confirm' => $auto,
        'occupancy_minutes' => $slot * ($blockNext ? 2 : 1),
    ];
}

function mt_set_runtime_booking_settings(?array $settings): array {
    $GLOBALS['mt_runtime_booking_settings'] = mt_normalize_booking_settings($settings ?? []);
    return $GLOBALS['mt_runtime_booking_settings'];
}

function mt_runtime_booking_settings(): array {
    if (!isset($GLOBALS['mt_runtime_booking_settings']) || !is_array($GLOBALS['mt_runtime_booking_settings'])) {
        $GLOBALS['mt_runtime_booking_settings'] = mt_normalize_booking_settings([]);
    }
    return $GLOBALS['mt_runtime_booking_settings'];
}

function mt_slot_minutes(): int {
    return (int) mt_runtime_booking_settings()['slot_minutes'];
}

function mt_occupancy_minutes(): int {
    return (int) mt_runtime_booking_settings()['occupancy_minutes'];
}

function mt_hhmm_to_minutes(string $time): ?int {
    if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $time, $m)) {
        return null;
    }
    return ((int) $m[1]) * 60 + (int) $m[2];
}

function mt_minutes_to_hhmm(int $minutes): string {
    $minutes = $minutes % (24 * 60);
    if ($minutes < 0) {
        $minutes += 24 * 60;
    }
    return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
}

function mt_is_slot_aligned(int $minutes): bool {
    $slot = mt_slot_minutes();
    $span = mt_occupancy_minutes();
    return $minutes >= 0 && $slot > 0 && $minutes % $slot === 0 && $minutes <= 24 * 60 - $span;
}

/** @return list<int> */
function mt_period_slot_minutes(int $from, int $to): array {
    $slot = mt_slot_minutes();
    if ($slot < 1 || $to - $from < $slot) {
        return [];
    }
    $aligned = (int) (ceil($from / $slot) * $slot);
    $minutes = [];
    for ($m = $aligned; $m + $slot <= $to; $m += $slot) {
        $minutes[] = $m;
    }
    return $minutes;
}

function mt_interval_covered_by_periods(array $periods, int $startMinute, int $duration): bool {
    $end = $startMinute + $duration;
    foreach ($periods as $period) {
        $from = (int) $period['start_minute'];
        $to = (int) $period['end_minute'];
        if ($startMinute >= $from && $end <= $to) {
            return true;
        }
    }
    return false;
}

function mt_game_fits_periods(array $periods, int $startMinute): bool {
    return mt_interval_covered_by_periods($periods, $startMinute, mt_occupancy_minutes());
}

function mt_slot_unit_in_periods(array $periods, int $startMinute): bool {
    return mt_interval_covered_by_periods($periods, $startMinute, mt_slot_minutes());
}

function mt_ranges_overlap(int $aStart, int $aDuration, int $bStart, int $bDuration): bool {
    return $aStart < $bStart + $bDuration && $bStart < $aStart + $aDuration;
}

function mt_intervals_overlap(int $aStart, int $bStart): bool {
    $span = mt_occupancy_minutes();
    return mt_ranges_overlap($aStart, $span, $bStart, $span);
}

function mt_occupancy_duration(array $booking): int {
    $duration = (int) ($booking['duration_minutes'] ?? 0);
    return $duration >= 15 ? $duration : mt_occupancy_minutes();
}

/**
 * @param list<int>|array<int,string> $flags
 * @return array<int,string>
 */
function mt_normalize_slot_flags(array $flags): array {
    if ($flags === []) {
        return [];
    }
    $first = reset($flags);
    if ($first === 'hidden' || $first === 'closed') {
        $out = [];
        foreach ($flags as $minute => $kind) {
            $out[(int) $minute] = $kind === 'hidden' ? 'hidden' : 'closed';
        }
        return $out;
    }
    $out = [];
    foreach ($flags as $minute) {
        $out[(int) $minute] = 'closed';
    }
    return $out;
}

function mt_next_admin_slot_status(string $status): ?string {
    if ($status === 'open') {
        return 'hidden';
    }
    if ($status === 'hidden') {
        return 'closed';
    }
    if ($status === 'closed') {
        return 'open';
    }
    return null;
}

/**
 * Occupancy: the start unit on the booked room is reserved; other occupied units are closed.
 *
 * @param list<array{start_minute:int,duration_minutes?:int,status?:string,room_slug?:string}> $bookings
 * @param list<int>|array<int,string> $flags
 */
function mt_unit_status(int $minute, array $bookings, array $flags = [], ?string $room = null): string {
    foreach ($bookings as $booking) {
        if (!mt_ranges_overlap($minute, mt_slot_minutes(), (int) $booking['start_minute'], mt_occupancy_duration($booking))) {
            continue;
        }
        $bookingRoom = (string) ($booking['room_slug'] ?? '');
        $sameRoom = $room === null || $bookingRoom === '' || $bookingRoom === $room;
        if ($sameRoom && $minute === (int) $booking['start_minute']) {
            return 'reserved';
        }
        return 'closed';
    }
    $kind = mt_normalize_slot_flags($flags)[$minute] ?? null;
    if ($kind === 'hidden' || $kind === 'closed') {
        return $kind;
    }
    return 'open';
}

/** @param list<array{start_minute:int,duration_minutes?:int,status?:string}> $bookings */
function mt_booking_covering_minute(array $bookings, int $minute): ?array {
    foreach ($bookings as $booking) {
        if (mt_ranges_overlap($minute, mt_slot_minutes(), (int) $booking['start_minute'], mt_occupancy_duration($booking))) {
            return $booking;
        }
    }
    return null;
}

/**
 * @param list<array{time:string,minute:int,status:string}> $slots
 * @param list<array{id?:int,guest_name?:string,start_minute:int}> $bookings
 * @return list<array{time:string,minute:int,status:string,booking_id?:int,guest_name?:string}>
 */
function mt_annotate_reserved_slots(array $slots, array $bookings): array {
    foreach ($slots as &$slot) {
        $booking = mt_booking_covering_minute($bookings, (int) $slot['minute']);
        if (!$booking) {
            continue;
        }
        if (isset($booking['id'])) {
            $slot['booking_id'] = (int) $booking['id'];
        }
        if (($slot['status'] ?? '') === 'reserved' && isset($booking['guest_name'])) {
            $slot['guest_name'] = (string) $booking['guest_name'];
        }
    }
    unset($slot);
    return $slots;
}

/**
 * @param list<int> $minutes
 * @param list<array{start_minute:int}> $bookings
 * @param list<int>|array<int,string> $flags
 * @return list<array{time:string,minute:int,status:string}>
 */
function mt_slots_from_minutes(array $minutes, array $bookings, array $flags = [], ?string $room = null): array {
    $normalized = mt_normalize_slot_flags($flags);
    $slots = [];
    foreach ($minutes as $minute) {
        $slots[] = [
            'time' => mt_minutes_to_hhmm($minute),
            'minute' => $minute,
            'status' => mt_unit_status($minute, $bookings, $normalized, $room),
        ];
    }
    return $slots;
}

/**
 * @param list<array{time:string,minute:int,status:string}> $slots
 * @return list<array{time:string,minute:int,status:string}>
 */
function mt_filter_public_slots(array $slots): array {
    return array_values(array_filter($slots, static fn($slot) => ($slot['status'] ?? '') !== 'hidden'));
}

/**
 * @param list<array{start_minute:int,end_minute:int}> $periods
 * @return list<int>
 */
function mt_game_start_minutes(array $periods): array {
    $starts = [];
    foreach ($periods as $period) {
        $from = (int) $period['start_minute'];
        $to = (int) $period['end_minute'];
        $slot = mt_slot_minutes();
        $span = mt_occupancy_minutes();
        $aligned = (int) (ceil($from / $slot) * $slot);
        for ($m = $aligned; $m + $span <= $to; $m += $slot) {
            if (!mt_game_fits_periods($periods, $m)) {
                continue;
            }
            $starts[$m] = true;
        }
    }
    ksort($starts);
    return array_map('intval', array_keys($starts));
}

/**
 * @param list<array{start_minute:int,end_minute:int}> $periods
 * @return list<int>
 */
function mt_unit_minutes(array $periods): array {
    $units = [];
    foreach ($periods as $period) {
        foreach (mt_period_slot_minutes((int) $period['start_minute'], (int) $period['end_minute']) as $minute) {
            $units[$minute] = true;
        }
    }
    ksort($units);
    return array_map('intval', array_keys($units));
}

/**
 * Public starts: every slot where occupancy still fits the opening period.
 *
 * @param list<array{start_minute:int,end_minute:int}> $periods
 * @param list<array{start_minute:int}> $bookings
 * @param list<int>|array<int,string> $flags
 * @return list<array{time:string,minute:int,status:string}>
 */
function mt_compute_day_slots(array $periods, array $bookings, array $flags = [], ?string $room = null): array {
    return mt_slots_from_minutes(mt_game_start_minutes($periods), $bookings, $flags, $room);
}

/**
 * Admin grid: every slot unit inside the opening periods.
 *
 * @param list<array{start_minute:int,end_minute:int}> $periods
 * @param list<array{start_minute:int}> $bookings
 * @param list<int>|array<int,string> $flags
 * @return list<array{time:string,minute:int,status:string}>
 */
function mt_compute_unit_slots(array $periods, array $bookings, array $flags = [], ?string $room = null): array {
    return mt_slots_from_minutes(mt_unit_minutes($periods), $bookings, $flags, $room);
}
