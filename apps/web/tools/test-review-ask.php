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

$env = mt_boot();
$pdo = mt_pdo($env);
mt_ensure_schema($pdo);
expect(mt_table_has_column($pdo, 'bookings', 'review_ask'), 'review_ask column exists');

$today = mt_today_paris();
$yesterday = (new DateTimeImmutable($today, new DateTimeZone('Europe/Paris')))
    ->modify('-1 day')
    ->format('Y-m-d');
$tomorrow = (new DateTimeImmutable($today, new DateTimeZone('Europe/Paris')))
    ->modify('+1 day')
    ->format('Y-m-d');

$stamp = 'rev-' . bin2hex(random_bytes(4));
$insert = $pdo->prepare('INSERT INTO bookings (room_slug, booking_date, start_minute, duration_minutes, guest_name, guest_email, guest_phone, players, status, review_ask) VALUES (?,?,?,?,?,?,?,?,?,?)');

$insert->execute(['directeur', $yesterday, 840, 60, $stamp, 'ada@example.com', '0612345678', 4, 'confirmed', null]);
$eligibleId = (int) $pdo->lastInsertId();
$insert->execute(['directeur', $yesterday, 900, 60, $stamp, 'bob@example.com', '0612345678', 4, 'confirmed', 'sent']);
$sentId = (int) $pdo->lastInsertId();
$insert->execute(['directeur', $today, 840, 60, $stamp, 'cara@example.com', '0612345678', 4, 'confirmed', null]);
$todayId = (int) $pdo->lastInsertId();
$insert->execute(['directeur', $yesterday, 960, 60, $stamp, 'dan@example.com', '0612345678', 4, 'pending', null]);
$pendingId = (int) $pdo->lastInsertId();

try {
    expect(mt_normalize_booking_filter('avis') === 'avis', 'normalize avis');
    $page = mt_list_bookings_page($pdo, 'avis', 1, null, $env);
    expect($page['filtre'] === 'avis', 'filtre echoed');
    $ids = array_map(fn($row) => (int) $row['id'], $page['bookings']);
    expect(in_array($eligibleId, $ids, true), 'eligible in avis');
    expect(!in_array($sentId, $ids, true), 'sent excluded');
    expect(!in_array($todayId, $ids, true), 'today excluded');
    expect(!in_array($pendingId, $ids, true), 'pending excluded');

    $row = mt_get_booking($pdo, $eligibleId, $env);
    expect($row['review_ask'] === null, 'eligible review_ask null');
    expect($row['past_actions'] === true, 'eligible past_actions');
    expect($row['can_ask_review'] === true, 'eligible can_ask');
    expect(str_contains((string) $row['review_url'], '/api/avis.php?b=' . $eligibleId), 'review_url');

    $todayRow = mt_get_booking($pdo, $todayId, $env);
    expect($todayRow['past_actions'] === false, 'today not past');
    expect($todayRow['can_ask_review'] === false, 'today cannot ask');

    $pendingRow = mt_get_booking($pdo, $pendingId, $env);
    expect($pendingRow['past_actions'] === true, 'pending yesterday is past');
    expect($pendingRow['can_ask_review'] === false, 'pending cannot ask');

    expect(mt_mark_review_ask($pdo, $eligibleId, 'skipped') === true, 'first skip marks');
    expect(mt_get_booking($pdo, $eligibleId, $env)['review_ask'] === 'skipped', 'skipped persisted');
    expect(mt_mark_review_ask($pdo, $eligibleId, 'sent') === false, 'second mark fails');

    $insert->execute(['directeur', $yesterday, 1020, 60, $stamp, 'eve@example.com', '0612345678', 4, 'confirmed', null]);
    $secondId = (int) $pdo->lastInsertId();
    expect(mt_mark_review_ask($pdo, $secondId, 'sent') === true, 'sent marks');
    expect(mt_get_booking($pdo, $secondId, $env)['can_ask_review'] === false, 'sent cannot ask');
} finally {
    $pdo->prepare("DELETE FROM bookings WHERE guest_name = ?")->execute([$stamp]);
}

if ($failed > 0) {
    fwrite(STDERR, "$failed assertion(s) failed\n");
    exit(1);
}
echo "OK\n";
