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
    return mt_period_payload((int) $pdo->lastInsertId(), $date, $startMinute, $endMinute);
}

function mt_period_payload(int $id, string $date, int $startMinute, int $endMinute): array {
    return [
        'id' => $id,
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

function mt_update_period(PDO $pdo, int $id, string $date, int $startMinute, int $endMinute): ?array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('UPDATE opening_periods SET period_date = ?, start_minute = ?, end_minute = ? WHERE id = ?');
    $stmt->execute([$date, $startMinute, $endMinute, $id]);
    if ($stmt->rowCount() === 0) {
        $exists = $pdo->prepare('SELECT id FROM opening_periods WHERE id = ?');
        $exists->execute([$id]);
        if (!$exists->fetch()) {
            return null;
        }
    }
    return mt_period_payload($id, $date, $startMinute, $endMinute);
}

function mt_get_period(PDO $pdo, int $id): ?array {
    mt_ensure_schema($pdo);
    $stmt = $pdo->prepare('SELECT id, period_date, start_minute, end_minute FROM opening_periods WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    return mt_period_payload((int) $row['id'], (string) $row['period_date'], (int) $row['start_minute'], (int) $row['end_minute']);
}

function mt_dates_with_periods(PDO $pdo, array $dates): array {
    $dates = array_values(array_unique($dates));
    if ($dates === []) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($dates), '?'));
    $stmt = $pdo->prepare("SELECT DISTINCT period_date FROM opening_periods WHERE period_date IN ($placeholders)");
    $stmt->execute($dates);
    return array_map(static fn($row) => (string) $row['period_date'], $stmt->fetchAll());
}

function mt_delete_periods_on_date(PDO $pdo, string $date): void {
    $pdo->prepare('DELETE FROM opening_periods WHERE period_date = ?')->execute([$date]);
}

function mt_replace_closed_slots_from_source(PDO $pdo, string $sourceDate, string $targetDate): void {
    $pdo->prepare('DELETE FROM closed_slots WHERE slot_date = ?')->execute([$targetDate]);
    foreach (MT_ROOM_SLUGS as $room) {
        $flags = mt_slot_flags_for($pdo, $room, $sourceDate);
        $bookings = mt_fetch_active_bookings($pdo, $targetDate, $targetDate, $room);
        foreach ($flags as $minute => $kind) {
            if (mt_unit_status((int) $minute, $bookings, []) === 'reserved') {
                continue;
            }
            mt_set_slot_kind($pdo, $room, $targetDate, (int) $minute, $kind === 'hidden' ? 'hidden' : 'closed');
        }
    }
}

function mt_copy_period(PDO $pdo, int $sourceId, array $dates, bool $overwrite): array {
    mt_ensure_schema($pdo);
    $source = mt_get_period($pdo, $sourceId);
    if (!$source) {
        return ['ok' => false, 'error' => 'not_found'];
    }
    $clean = [];
    foreach ($dates as $date) {
        $date = is_string($date) ? trim($date) : '';
        if (!mt_is_iso_date($date) || $date === $source['period_date']) {
            continue;
        }
        $clean[$date] = $date;
    }
    $clean = array_values($clean);
    sort($clean);
    if ($clean === []) {
        return ['ok' => false, 'error' => 'invalid'];
    }
    $conflicts = mt_dates_with_periods($pdo, $clean);
    sort($conflicts);
    if ($conflicts !== [] && !$overwrite) {
        return ['ok' => false, 'dates' => $conflicts];
    }
    $pdo->beginTransaction();
    try {
        foreach ($clean as $date) {
            mt_delete_periods_on_date($pdo, $date);
            mt_add_period($pdo, $date, (int) $source['start_minute'], (int) $source['end_minute']);
            mt_replace_closed_slots_from_source($pdo, $source['period_date'], $date);
        }
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return ['ok' => true, 'copied' => count($clean)];
}

function mt_booking_select_sql(): string {
    return 'id, room_slug, booking_date, start_minute, duration_minutes, guest_name, guest_email, guest_phone, players, status, created_at';
}

function mt_booking_duration(array $booking): int {
    return mt_occupancy_duration($booking);
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

const MT_BOOKINGS_PAGE_SIZE = 10;

function mt_normalize_booking_filter(?string $raw): string {
    $value = strtolower(trim((string) $raw));
    if (in_array($value, ['a-confirmer', 'pending', 'aconfirmer'], true)) {
        return 'a-confirmer';
    }
    if (in_array($value, ['toutes', 'all'], true)) {
        return 'toutes';
    }
    return 'aujourdhui';
}

function mt_list_bookings_page(PDO $pdo, string $filter = 'aujourdhui', int $page = 1, ?int $focusId = null): array {
    mt_ensure_schema($pdo);
    $filter = mt_normalize_booking_filter($filter);
    $perPage = MT_BOOKINGS_PAGE_SIZE;
    $sql = 'SELECT ' . mt_booking_select_sql() . ' FROM bookings';
    $where = [];
    $args = [];
    if ($filter === 'aujourdhui') {
        $where[] = 'booking_date = ?';
        $args[] = mt_today_paris();
    } elseif ($filter === 'a-confirmer') {
        $where[] = "status = 'pending'";
    }
    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    if ($filter === 'aujourdhui') {
        $sql .= ' ORDER BY start_minute ASC, id ASC';
    } elseif ($filter === 'a-confirmer') {
        $sql .= ' ORDER BY created_at DESC, id DESC';
    } else {
        $sql .= ' ORDER BY booking_date DESC, start_minute DESC, id DESC';
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    $all = mt_map_booking_rows($stmt->fetchAll());
    $total = count($all);
    $pages = max(1, (int) ceil($total / $perPage));
    if ($focusId) {
        foreach ($all as $index => $row) {
            if ((int) $row['id'] === $focusId) {
                $page = intdiv($index, $perPage) + 1;
                break;
            }
        }
    }
    $page = max(1, min($page < 1 ? 1 : $page, $pages));
    $offset = ($page - 1) * $perPage;
    return [
        'bookings' => array_slice($all, $offset, $perPage),
        'total' => $total,
        'page' => $page,
        'perPage' => $perPage,
        'pages' => $pages,
        'filtre' => $filter,
        'settings' => mt_runtime_booking_settings(),
    ];
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

function mt_occupying_bookings(PDO $pdo, string $date, string $room): array {
    $roomFilter = mt_runtime_booking_settings()['block_both_rooms'] ? null : $room;
    return mt_fetch_active_bookings($pdo, $date, $date, $roomFilter);
}

function mt_public_day_slots(PDO $pdo, string $room, string $date): array {
    $periods = mt_periods_for_date($pdo, $date);
    $bookings = mt_occupying_bookings($pdo, $date, $room);
    return mt_filter_public_slots(mt_compute_day_slots($periods, $bookings, mt_slot_flags_for($pdo, $room, $date)));
}

function mt_admin_day_slots(PDO $pdo, string $room, string $date): array {
    $periods = mt_periods_for_date($pdo, $date);
    $bookings = mt_occupying_bookings($pdo, $date, $room);
    return mt_annotate_reserved_slots(
        mt_compute_unit_slots($periods, $bookings, mt_slot_flags_for($pdo, $room, $date)),
        $bookings
    );
}

function mt_slot_flags_for(PDO $pdo, string $room, string $date): array {
    mt_ensure_schema($pdo);
    $sql = mt_table_has_column($pdo, 'closed_slots', 'kind')
        ? 'SELECT start_minute, kind FROM closed_slots WHERE room_slug = ? AND slot_date = ? ORDER BY start_minute ASC'
        : 'SELECT start_minute FROM closed_slots WHERE room_slug = ? AND slot_date = ? ORDER BY start_minute ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$room, $date]);
    $flags = [];
    foreach ($stmt->fetchAll() as $row) {
        $flags[(int) $row['start_minute']] = (($row['kind'] ?? '') === 'hidden') ? 'hidden' : 'closed';
    }
    return $flags;
}

function mt_closed_minutes_for(PDO $pdo, string $room, string $date): array {
    return array_map('intval', array_keys(mt_slot_flags_for($pdo, $room, $date)));
}

function mt_map_closed_slot(string $room, string $date, int $startMinute, string $kind = 'closed'): array {
    return [
        'room_slug' => $room,
        'slot_date' => $date,
        'start_minute' => $startMinute,
        'time' => mt_minutes_to_hhmm($startMinute),
        'kind' => $kind === 'hidden' ? 'hidden' : 'closed',
    ];
}

function mt_set_slot_kind(PDO $pdo, string $room, string $date, int $startMinute, string $kind): array {
    mt_ensure_schema($pdo);
    if ($kind !== 'hidden' && $kind !== 'closed') {
        throw new InvalidArgumentException('Statut de créneau invalide.');
    }
    if (!in_array($room, MT_ROOM_SLUGS, true)) {
        throw new InvalidArgumentException('Salle inconnue.');
    }
    if (!mt_is_iso_date($date) || $startMinute < 0 || $startMinute % mt_slot_minutes() !== 0 || $startMinute > 24 * 60 - mt_slot_minutes()) {
        throw new InvalidArgumentException('Date ou horaire invalide.');
    }
    if (!mt_slot_unit_in_periods(mt_periods_for_date($pdo, $date), $startMinute)) {
        throw new InvalidArgumentException('Ce créneau n’est pas dans une plage ouverte.');
    }
    foreach (mt_occupying_bookings($pdo, $date, $room) as $booking) {
        if (mt_ranges_overlap($startMinute, mt_slot_minutes(), (int) $booking['start_minute'], mt_booking_duration($booking))) {
            throw new RuntimeException('Ce créneau est déjà réservé.');
        }
    }
    if (mt_table_has_column($pdo, 'closed_slots', 'kind')) {
        $stmt = $pdo->prepare('INSERT INTO closed_slots (room_slug, slot_date, start_minute, kind) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE kind = ?');
        $stmt->execute([$room, $date, $startMinute, $kind, $kind]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO closed_slots (room_slug, slot_date, start_minute) VALUES (?,?,?)');
        try {
            $stmt->execute([$room, $date, $startMinute]);
        } catch (Throwable $ignored) {
            /* already closed */
        }
        $kind = 'closed';
    }
    return mt_map_closed_slot($room, $date, $startMinute, $kind);
}

function mt_close_slot(PDO $pdo, string $room, string $date, int $startMinute): array {
    return mt_set_slot_kind($pdo, $room, $date, $startMinute, 'closed');
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
    $slot = mt_slot_minutes();
    $follow = mt_minutes_to_hhmm($start + $slot);
    if (!mt_interval_covered_by_periods($periods, $start, $duration)) {
        throw new RuntimeException("Le créneau suivant ({$follow}) n’est pas disponible. Impossible de {$action}.");
    }
    foreach (mt_closed_minutes_for($pdo, $room, $date) as $closedMinute) {
        if (mt_ranges_overlap($start, $duration, (int) $closedMinute, $slot)) {
            throw new RuntimeException("Le créneau suivant ({$follow}) n’est pas disponible. Impossible de {$action}.");
        }
    }
    $others = mt_occupying_bookings($pdo, $date, $room);
    foreach ($others as $other) {
        if ($ignoreBookingId !== null && (int) $other['id'] === $ignoreBookingId) {
            continue;
        }
        if (mt_ranges_overlap($start, $duration, (int) $other['start_minute'], mt_booking_duration($other))) {
            throw new RuntimeException("Le créneau suivant ({$follow}) n’est pas disponible. Impossible de {$action}.");
        }
    }
}

function mt_create_booking(PDO $pdo, array $row): array {
    $settings = mt_runtime_booking_settings();
    $duration = (int) ($row['duration_minutes'] ?? $settings['occupancy_minutes']);
    $status = (string) ($row['status'] ?? ($settings['auto_confirm'] ? 'confirmed' : 'pending'));
    if ($status !== 'confirmed') {
        $status = 'pending';
    }
    $stmt = $pdo->prepare('INSERT INTO bookings (room_slug, booking_date, start_minute, duration_minutes, guest_name, guest_email, guest_phone, players, status) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $row['room_slug'],
        $row['booking_date'],
        $row['start_minute'],
        $duration,
        $row['guest_name'],
        $row['guest_email'],
        $row['guest_phone'],
        $row['players'],
        $status,
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
    $duration = mt_booking_duration($current);
    if ($current['status'] === 'confirmed') {
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
        $duration,
        (int) $current['id'],
        'confirmer cette réservation'
    );
    $stmt = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ? AND status = 'pending'");
    $stmt->execute([$id]);
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
        if (!mt_is_iso_date($nextDate) || $nextStart === null || $nextStart % mt_slot_minutes() !== 0) {
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
            'déplacer cette réservation'
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
