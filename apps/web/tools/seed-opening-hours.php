#!/usr/bin/env php
<?php
declare(strict_types=1);
/**
 * Seeds Wed–Sun 10:00–22:00 opening periods for 18 months when the table is empty.
 * Usage: php seed-opening-hours.php /path/to/public_html/api
 */

$apiDir = $argv[1] ?? (dirname(__DIR__) . '/public/api');
require_once rtrim($apiDir, '/') . '/bootstrap.php';

$env = mt_boot();
$pdo = mt_pdo($env);
mt_ensure_schema($pdo);

$count = (int) $pdo->query('SELECT COUNT(*) FROM opening_periods')->fetchColumn();
if ($count > 0) {
    fwrite(STDOUT, "opening_periods déjà remplie ($count lignes) — rien à faire.\n");
    exit(0);
}

$startMinute = 10 * 60;
$endMinute = 22 * 60;
$start = new DateTimeImmutable('today');
$end = $start->modify('+18 months');
$stmt = $pdo->prepare('INSERT INTO opening_periods (period_date, start_minute, end_minute) VALUES (?,?,?)');
$inserted = 0;
for ($day = $start; $day <= $end; $day = $day->modify('+1 day')) {
    $weekday = (int) $day->format('N');
    if ($weekday < 3) {
        continue;
    }
    $stmt->execute([$day->format('Y-m-d'), $startMinute, $endMinute]);
    $inserted++;
}
fwrite(STDOUT, "Inséré $inserted plages (mercredi–dimanche, 10:00–22:00).\n");
