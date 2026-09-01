<?php
declare(strict_types=1);

const MT_SLOT_MINUTES = 30;
const MT_GAME_SLOTS = 2;
const MT_GAME_MINUTES = MT_SLOT_MINUTES * MT_GAME_SLOTS;
const MT_ROOM_SLUGS = ['directeur', 'vaisseau'];

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
    return $minutes >= 0 && $minutes % MT_SLOT_MINUTES === 0 && $minutes <= 24 * 60 - MT_GAME_MINUTES;
}

/** @return list<int> */
function mt_period_slot_minutes(int $from, int $to): array {
    if ($to - $from < MT_SLOT_MINUTES) {
        return [];
    }
    $aligned = (int) (ceil($from / MT_SLOT_MINUTES) * MT_SLOT_MINUTES);
    $minutes = [];
    for ($m = $aligned; $m + MT_SLOT_MINUTES <= $to; $m += MT_SLOT_MINUTES) {
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
    return mt_interval_covered_by_periods($periods, $startMinute, MT_GAME_MINUTES);
}

function mt_slot_unit_in_periods(array $periods, int $startMinute): bool {
    return mt_interval_covered_by_periods($periods, $startMinute, MT_SLOT_MINUTES);
}

function mt_ranges_overlap(int $aStart, int $aDuration, int $bStart, int $bDuration): bool {
    return $aStart < $bStart + $bDuration && $bStart < $aStart + $aDuration;
}

function mt_intervals_overlap(int $aStart, int $bStart): bool {
    return mt_ranges_overlap($aStart, MT_GAME_MINUTES, $bStart, MT_GAME_MINUTES);
}

function mt_occupancy_duration(array $booking): int {
    $duration = (int) ($booking['duration_minutes'] ?? 0);
    if ($duration > 0) {
        return $duration;
    }
    return (($booking['status'] ?? '') === 'pending') ? MT_SLOT_MINUTES : MT_GAME_MINUTES;
}

/**
 * @param list<array{start_minute:int,duration_minutes?:int,status?:string}> $bookings
 * @param list<int> $closedMinutes
 */
function mt_unit_status(int $minute, array $bookings, array $closedMinutes): string {
    foreach ($bookings as $booking) {
        if (mt_ranges_overlap($minute, MT_SLOT_MINUTES, (int) $booking['start_minute'], mt_occupancy_duration($booking))) {
            return 'reserved';
        }
    }
    foreach ($closedMinutes as $closed) {
        if ((int) $closed === $minute) {
            return 'closed';
        }
    }
    return 'open';
}

/**
 * @param list<int> $minutes
 * @param list<array{start_minute:int}> $bookings
 * @param list<int> $closedMinutes
 * @return list<array{time:string,minute:int,status:string}>
 */
function mt_slots_from_minutes(array $minutes, array $bookings, array $closedMinutes = []): array {
    $slots = [];
    foreach ($minutes as $minute) {
        $slots[] = [
            'time' => mt_minutes_to_hhmm($minute),
            'minute' => $minute,
            'status' => mt_unit_status($minute, $bookings, $closedMinutes),
        ];
    }
    return $slots;
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
        $aligned = (int) (ceil($from / MT_SLOT_MINUTES) * MT_SLOT_MINUTES);
        for ($m = $aligned; $m + MT_GAME_MINUTES <= $to; $m += MT_SLOT_MINUTES) {
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
 * Public starts: every 30 min where a 60-min game still fits the opening period.
 *
 * @param list<array{start_minute:int,end_minute:int}> $periods
 * @param list<array{start_minute:int}> $bookings
 * @param list<int> $closedMinutes
 * @return list<array{time:string,minute:int,status:string}>
 */
function mt_compute_day_slots(array $periods, array $bookings, array $closedMinutes = []): array {
    return mt_slots_from_minutes(mt_game_start_minutes($periods), $bookings, $closedMinutes);
}

/**
 * Admin grid: every 30-min unit inside the opening periods.
 *
 * @param list<array{start_minute:int,end_minute:int}> $periods
 * @param list<array{start_minute:int}> $bookings
 * @param list<int> $closedMinutes
 * @return list<array{time:string,minute:int,status:string}>
 */
function mt_compute_unit_slots(array $periods, array $bookings, array $closedMinutes = []): array {
    return mt_slots_from_minutes(mt_unit_minutes($periods), $bookings, $closedMinutes);
}
