<?php
declare(strict_types=1);

function mt_list_periods(PDO $pdo, ?string $from = null, ?string $to = null): array {
    mt_ensure_schema($pdo);
    if ($from && $to) {
        $stmt = $pdo->prepare('SELECT id, period_date, start_minute, end_minute FROM opening_periods WHERE period_date BETWEEN ? AND ? ORDER BY period_date ASC, start_minute ASC');
        $stmt->execute([$from, $to]);
    } else {
        $stmt = $pdo->query('SELECT id, period_date, start_minute, end_minute FROM opening_periods WHERE period_date >= CURDATE() ORDER BY period_date ASC, start_minute ASC');
    }
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['start_minute'] = (int) $row['start_minute'];
        $row['end_minute'] = (int) $row['end_minute'];
        $row['start'] = mt_minutes_to_hhmm($row['start_minute']);
        $row['end'] = mt_minutes_to_hhmm($row['end_minute']);
    }
    return $rows;
}

function mt_periods_for_date(PDO $pdo, string $date): array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT start_minute, end_minute FROM opening_periods WHERE period_date = ? ORDER BY start_minute ASC');
    $stmt->execute([$date]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['start_minute'] = (int) $row['start_minute'];
        $row['end_minute'] = (int) $row['end_minute'];
    }
    return $rows;
}

function mt_add_period(PDO $pdo, string $date, int $startMinute, int $endMinute): array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('INSERT INTO opening_periods (period_date, start_minute, end_minute) VALUES (?,?,?)');
    $stmt->execute([$date, $startMinute, $endMinute]);
    return [
        'id' => (int) $pdo->lastInsertId(),
        'period_date' => $date,
        'start_minute' => $startMinute,
        'end_minute' => $endMinute,
        'start' => mt_minutes_to_hhmm($startMinute),
        'end' => mt_minutes_to_hhmm($endMinute),
    ];
}

function mt_delete_period(PDO $pdo, int $id): bool {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('DELETE FROM opening_periods WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
}

function mt_booking_select_sql(): string {
    return 'id, room_slug, booking_date, start_minute, duration_minutes, guest_name, guest_email, guest_phone, players, status, created_at';
}

function mt_booking_duration(array $booking): int {
    if (isset($booking['duration_minutes'])) {
        $duration = (int) $booking['duration_minutes'];
        if ($duration > 0) {
            return $duration;
        }
    }
    return ($booking['status'] ?? '') === 'confirmed' ? MT_GAME_MINUTES : MT_SLOT_MINUTES;
}

function mt_map_booking_rows(array $rows): array {
    foreach ($rows as &$row) {
        $row['id'] = (int) $row['id'];
        $row['start_minute'] = (int) $row['start_minute'];
        $row['players'] = (int) $row['players'];
        $row['duration_minutes'] = mt_booking_duration($row);
        $row['time'] = mt_minutes_to_hhmm($row['start_minute']);
        $row['end_time'] = mt_minutes_to_hhmm($row['start_minute'] + $row['duration_minutes']);
    }
    return $rows;
}

function mt_get_booking(PDO $pdo, int $id): ?array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT ' . mt_booking_select_sql() . ' FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? mt_map_booking_rows([$row])[0] : null;
}

function mt_list_bookings(PDO $pdo): array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->query('SELECT ' . mt_booking_select_sql() . ' FROM bookings ORDER BY created_at DESC, id DESC');
    return mt_map_booking_rows($stmt->fetchAll());
}

function mt_fetch_active_bookings(PDO $pdo, ?string $from = null, ?string $to = null, ?string $room = null): array {
    mt_ensure_schema($pdo);
    $sql = 'SELECT ' . mt_booking_select_sql() . " FROM bookings WHERE status IN ('pending','confirmed')";
    $args = [];
    if ($from && $to) {
        $sql .= ' AND booking_date BETWEEN ? AND ?';
        $args[] = $from;
        $args[] = $to;
    }
    if ($room) {
        $sql .= ' AND room_slug = ?';
        $args[] = $room;
    }
    $sql .= ' ORDER BY created_at DESC, id DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    return mt_map_booking_rows($stmt->fetchAll());
}

function mt_public_day_slots(PDO $pdo, string $room, string $date): array {
    $periods = mt_periods_for_date($pdo, $date);
    $bookings = mt_fetch_active_bookings($pdo, $date, $date, $room);
    return mt_compute_day_slots($periods, $bookings, mt_closed_minutes_for($pdo, $room, $date));
}

function mt_admin_day_slots(PDO $pdo, string $room, string $date): array {
    $periods = mt_periods_for_date($pdo, $date);
    $bookings = mt_fetch_active_bookings($pdo, $date, $date, $room);
    return mt_compute_unit_slots($periods, $bookings, mt_closed_minutes_for($pdo, $room, $date));
}

function mt_closed_minutes_for(PDO $pdo, string $room, string $date): array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT start_minute FROM closed_slots WHERE room_slug = ? AND slot_date = ? ORDER BY start_minute ASC');
    $stmt->execute([$room, $date]);
    return array_map(static fn($row) => (int) $row['start_minute'], $stmt->fetchAll());
}

function mt_map_closed_slot(string $room, string $date, int $startMinute): array {
    return [
        'room_slug' => $room,
        'slot_date' => $date,
        'start_minute' => $startMinute,
        'time' => mt_minutes_to_hhmm($startMinute),
    ];
}

function mt_close_slot(PDO $pdo, string $room, string $date, int $startMinute): array {
    mt_ensure_schema($pdo);
    if (!in_array($room, MT_ROOM_SLUGS, true)) {
        throw new InvalidArgumentException('Salle inconnue.');
    }
    if (!mt_is_iso_date($date) || $startMinute < 0 || $startMinute % MT_SLOT_MINUTES !== 0 || $startMinute > 24 * 60 - MT_SLOT_MINUTES) {
        throw new InvalidArgumentException('Date ou horaire invalide.');
    }
    if (!mt_slot_unit_in_periods(mt_periods_for_date($pdo, $date), $startMinute)) {
        throw new InvalidArgumentException('Ce créneau n’est pas dans une plage ouverte.');
    }
    foreach (mt_fetch_active_bookings($pdo, $date, $date, $room) as $booking) {
        if (mt_ranges_overlap($startMinute, MT_SLOT_MINUTES, (int) $booking['start_minute'], mt_booking_duration($booking))) {
            throw new RuntimeException('Ce créneau est déjà réservé.');
        }
    }
    if (in_array($startMinute, mt_closed_minutes_for($pdo, $room, $date), true)) {
        return mt_map_closed_slot($room, $date, $startMinute);
    }
    $stmt = $pdo->prepare('INSERT INTO closed_slots (room_slug, slot_date, start_minute) VALUES (?,?,?)');
    $stmt->execute([$room, $date, $startMinute]);
    return mt_map_closed_slot($room, $date, $startMinute);
}

function mt_open_slot(PDO $pdo, string $room, string $date, int $startMinute): bool {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('DELETE FROM closed_slots WHERE room_slug = ? AND slot_date = ? AND start_minute = ?');
    $stmt->execute([$room, $date, $startMinute]);
    return $stmt->rowCount() > 0;
}

function mt_find_open_game_slot(PDO $pdo, string $room, string $date, int $start): ?array {
    foreach (mt_public_day_slots($pdo, $room, $date) as $slot) {
        if ($slot['minute'] === $start && $slot['status'] === 'open') {
            return $slot;
        }
    }
    return null;
}

function mt_assert_window_available(
    PDO $pdo,
    string $room,
    string $date,
    int $start,
    int $duration,
    ?int $ignoreBookingId,
    string $action
): void {
    $periods = mt_periods_for_date($pdo, $date);
    if (!mt_interval_covered_by_periods($periods, $start, $duration)) {
        $follow = mt_minutes_to_hhmm($start + MT_SLOT_MINUTES);
        throw new RuntimeException("Le créneau suivant ({$follow}) n’est pas disponible. Impossible de {$action}.");
    }
    foreach (mt_closed_minutes_for($pdo, $room, $date) as $closedMinute) {
        if (mt_ranges_overlap($start, $duration, (int) $closedMinute, MT_SLOT_MINUTES)) {
            $follow = mt_minutes_to_hhmm($start + MT_SLOT_MINUTES);
            throw new RuntimeException("Le créneau suivant ({$follow}) n’est pas disponible. Impossible de {$action}.");
        }
    }
    $others = mt_fetch_active_bookings($pdo, $date, $date, $room);
    foreach ($others as $other) {
        if ($ignoreBookingId !== null && (int) $other['id'] === $ignoreBookingId) {
            continue;
        }
        if (mt_ranges_overlap($start, $duration, (int) $other['start_minute'], mt_booking_duration($other))) {
            $follow = mt_minutes_to_hhmm($start + MT_SLOT_MINUTES);
            throw new RuntimeException("Le créneau suivant ({$follow}) n’est pas disponible. Impossible de {$action}.");
        }
    }
}

function mt_create_booking(PDO $pdo, array $row): array {
    $stmt = $pdo->prepare("INSERT INTO bookings (room_slug, booking_date, start_minute, duration_minutes, guest_name, guest_email, guest_phone, players, status) VALUES (?,?,?,?,?,?,?,?,'pending')");
    $stmt->execute([
        $row['room_slug'],
        $row['booking_date'],
        $row['start_minute'],
        MT_SLOT_MINUTES,
        $row['guest_name'],
        $row['guest_email'],
        $row['guest_phone'],
        $row['players'],
    ]);
    return mt_get_booking($pdo, (int) $pdo->lastInsertId());
}

function mt_cancel_booking(PDO $pdo, int $id): bool {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status IN ('pending','confirmed')");
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
}

function mt_confirm_booking(PDO $pdo, int $id): ?array {
    mt_ensure_schema($pdo);
    $current = mt_get_booking($pdo, $id);
    if (!$current) {
        return null;
    }
    if ($current['status'] === 'confirmed') {
        if (mt_booking_duration($current) < MT_GAME_MINUTES) {
            mt_assert_window_available(
                $pdo,
                $current['room_slug'],
                $current['booking_date'],
                (int) $current['start_minute'],
                MT_GAME_MINUTES,
                (int) $current['id'],
                'confirmer une partie de 60 min'
            );
            $pdo->prepare('UPDATE bookings SET duration_minutes = ? WHERE id = ?')
                ->execute([MT_GAME_MINUTES, $id]);
            return mt_get_booking($pdo, $id);
        }
        return $current;
    }
    if ($current['status'] !== 'pending') {
        return null;
    }
    mt_assert_window_available(
        $pdo,
        $current['room_slug'],
        $current['booking_date'],
        (int) $current['start_minute'],
        MT_GAME_MINUTES,
        (int) $current['id'],
        'confirmer une partie de 60 min'
    );
    $stmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed', duration_minutes = ? WHERE id = ? AND status = 'pending'");
    $stmt->execute([MT_GAME_MINUTES, $id]);
    if ($stmt->rowCount() === 0) {
        $after = mt_get_booking($pdo, $id);
        return ($after && $after['status'] === 'confirmed') ? $after : null;
    }
    return mt_get_booking($pdo, $id);
}

function mt_update_booking(PDO $pdo, int $id, array $fields): ?array {
    mt_ensure_schema($pdo);
    $current = mt_get_booking($pdo, $id);
    if (!$current || $current['status'] === 'cancelled') {
        return null;
    }
    $name = $fields['guest_name'] ?? $current['guest_name'];
    $email = $fields['guest_email'] ?? $current['guest_email'];
    $phone = $fields['guest_phone'] ?? $current['guest_phone'];
    $players = $fields['players'] ?? $current['players'];
    $room = $current['room_slug'];
    $date = $current['booking_date'];
    $start = (int) $current['start_minute'];
    $duration = mt_booking_duration($current);
    if (isset($fields['date'], $fields['time'])) {
        $nextStart = mt_hhmm_to_minutes((string) $fields['time']);
        $nextDate = (string) $fields['date'];
        if (!mt_is_iso_date($nextDate) || $nextStart === null || $nextStart % MT_SLOT_MINUTES !== 0) {
            throw new InvalidArgumentException('Date ou horaire invalide.');
        }
        $date = $nextDate;
        $start = $nextStart;
    }
    $moved = $date !== $current['booking_date'] || $start !== (int) $current['start_minute'];
    if ($moved) {
        mt_assert_window_available(
            $pdo,
            $room,
            $date,
            $start,
            $duration,
            $id,
            $duration >= MT_GAME_MINUTES ? 'déplacer une partie de 60 min' : 'déplacer cette réservation'
        );
    }
    $stmt = $pdo->prepare('UPDATE bookings SET room_slug = ?, booking_date = ?, start_minute = ?, guest_name = ?, guest_email = ?, guest_phone = ?, players = ? WHERE id = ?');
    $stmt->execute([$room, $date, $start, $name, $email, $phone, $players, $id]);
    return mt_get_booking($pdo, $id);
}

function mt_today_paris(): string {
    $tz = new DateTimeZone('Europe/Paris');
    return (new DateTimeImmutable('now', $tz))->format('Y-m-d');
}

function mt_is_iso_date(string $date): bool {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return false;
    }
    $dt = DateTimeImmutable::createFromFormat('Y-m-d', $date);
    return $dt !== false && $dt->format('Y-m-d') === $date;
}
