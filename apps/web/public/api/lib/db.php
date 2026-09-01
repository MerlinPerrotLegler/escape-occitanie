<?php
declare(strict_types=1);

function mt_pdo(array $env): PDO {
    if (!empty($env['MYSQL_HOST']) && !empty($env['MYSQL_DATABASE'])) {
        $host = $env['MYSQL_HOST'];
        $port = (int) ($env['MYSQL_PORT'] ?? 3306);
        $user = $env['MYSQL_USER'] ?? '';
        $pass = $env['MYSQL_PASSWORD'] ?? '';
        $dbname = $env['MYSQL_DATABASE'];
    } elseif (!empty($env['DATABASE_URL'])) {
        $p = mt_parse_database_url($env['DATABASE_URL']);
        $host = $p['host'];
        $port = $p['port'];
        $user = $p['user'];
        $pass = $p['pass'];
        $dbname = $p['dbname'];
    } else {
        throw new RuntimeException('MySQL config missing');
    }
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $port, $dbname);
    return new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function mt_table_exists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $stmt->execute([$table]);
    return (int) $stmt->fetchColumn() > 0;
}

function mt_table_has_column(PDO $pdo, string $table, string $column): bool {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
    $stmt->execute([$table, $column]);
    return (int) $stmt->fetchColumn() > 0;
}

function mt_drop_foreign_keys_on_column(PDO $pdo, string $table, string $column): void {
    $stmt = $pdo->prepare("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL");
    $stmt->execute([$table, $column]);
    foreach ($stmt->fetchAll() as $row) {
        $name = str_replace('`', '', (string) $row['CONSTRAINT_NAME']);
        try {
            $pdo->exec("ALTER TABLE `$table` DROP FOREIGN KEY `$name`");
        } catch (Throwable $ignored) {
        }
    }
}

function mt_try_exec(PDO $pdo, string $sql): void {
    try {
        $pdo->exec($sql);
    } catch (Throwable $ignored) {
    }
}

function mt_ensure_closed_slots_schema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS closed_slots (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        room_slug VARCHAR(32) NOT NULL,
        slot_date DATE NOT NULL,
        start_minute SMALLINT UNSIGNED NOT NULL,
        kind VARCHAR(16) NOT NULL DEFAULT 'closed',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_closed_slot (room_slug, slot_date, start_minute)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    if (mt_table_exists($pdo, 'closed_slots') && !mt_table_has_column($pdo, 'closed_slots', 'kind')) {
        $pdo->exec("ALTER TABLE closed_slots ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'closed'");
    }
}

function mt_ensure_bookings_schema(PDO $pdo): void {
    $ddl = "CREATE TABLE bookings (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        room_slug VARCHAR(32) NOT NULL,
        booking_date DATE NOT NULL,
        start_minute SMALLINT UNSIGNED NOT NULL,
        duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
        guest_name VARCHAR(120) NOT NULL,
        guest_email VARCHAR(190) NOT NULL,
        guest_phone VARCHAR(40) NOT NULL,
        players TINYINT UNSIGNED NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bookings_day (room_slug, booking_date, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!mt_table_exists($pdo, 'bookings')) {
        $pdo->exec($ddl);
        return;
    }

    if (mt_table_has_column($pdo, 'bookings', 'slot_id')) {
        if (!mt_table_has_column($pdo, 'bookings', 'room_slug')) {
            $pdo->exec('ALTER TABLE bookings ADD COLUMN room_slug VARCHAR(32) NULL');
        }
        if (!mt_table_has_column($pdo, 'bookings', 'booking_date')) {
            $pdo->exec('ALTER TABLE bookings ADD COLUMN booking_date DATE NULL');
        }
        if (!mt_table_has_column($pdo, 'bookings', 'start_minute')) {
            $pdo->exec('ALTER TABLE bookings ADD COLUMN start_minute SMALLINT UNSIGNED NULL');
        }
        if (!mt_table_has_column($pdo, 'bookings', 'duration_minutes')) {
            $pdo->exec('ALTER TABLE bookings ADD COLUMN duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60');
        }
        if (mt_table_exists($pdo, 'slots')) {
            $pdo->exec("UPDATE bookings b
                INNER JOIN slots s ON s.id = b.slot_id
                SET b.room_slug = s.room_slug,
                    b.booking_date = s.slot_date,
                    b.start_minute = s.start_minute,
                    b.duration_minutes = 60");
        }
        $pdo->exec("UPDATE bookings SET duration_minutes = 60 WHERE duration_minutes < 60 AND status IN ('pending','confirmed')");
        $pdo->exec('DELETE FROM bookings WHERE room_slug IS NULL OR booking_date IS NULL OR start_minute IS NULL');
        if (mt_table_exists($pdo, 'booking_slots')) {
            mt_try_exec($pdo, 'DROP TABLE booking_slots');
        }
        mt_drop_foreign_keys_on_column($pdo, 'bookings', 'slot_id');
        mt_try_exec($pdo, 'ALTER TABLE bookings DROP INDEX idx_bookings_slot_status');
        mt_try_exec($pdo, 'ALTER TABLE bookings DROP COLUMN slot_id');
        mt_try_exec($pdo, 'ALTER TABLE bookings MODIFY room_slug VARCHAR(32) NOT NULL');
        mt_try_exec($pdo, 'ALTER TABLE bookings MODIFY booking_date DATE NOT NULL');
        mt_try_exec($pdo, 'ALTER TABLE bookings MODIFY start_minute SMALLINT UNSIGNED NOT NULL');
        mt_try_exec($pdo, 'ALTER TABLE bookings ADD INDEX idx_bookings_day (room_slug, booking_date, status)');
    }

    if (!mt_table_has_column($pdo, 'bookings', 'duration_minutes')) {
        $pdo->exec('ALTER TABLE bookings ADD COLUMN duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60');
    }
    mt_try_exec($pdo, "UPDATE bookings SET duration_minutes = 60 WHERE duration_minutes < 60 AND status IN ('pending','confirmed')");
    try {
        $col = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'duration_minutes'")->fetch();
        $default = (string) ($col['Default'] ?? '');
        if ($default !== '60') {
            $pdo->exec('ALTER TABLE bookings MODIFY duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60');
        }
    } catch (Throwable $ignored) {
    }

    try {
        $col = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'status'")->fetch();
        $default = strtolower((string) ($col['Default'] ?? ''));
        if ($default !== 'pending') {
            $pdo->exec("ALTER TABLE bookings MODIFY status VARCHAR(16) NOT NULL DEFAULT 'pending'");
        }
    } catch (Throwable $ignored) {
    }
}

function mt_retire_slot_tables(PDO $pdo): void {
    if (mt_table_exists($pdo, 'bookings') && mt_table_has_column($pdo, 'bookings', 'slot_id')) {
        return;
    }
    if (mt_table_exists($pdo, 'booking_slots')) {
        mt_try_exec($pdo, 'DROP TABLE booking_slots');
    }
    if (mt_table_exists($pdo, 'slots')) {
        mt_try_exec($pdo, 'DROP TABLE slots');
    }
}

function mt_ensure_schema(PDO $pdo): void {
    static $ready = false;
    if ($ready) {
        mt_ensure_closed_slots_schema($pdo);
        mt_ensure_bookings_schema($pdo);
        mt_retire_slot_tables($pdo);
        return;
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS site_reviews (
        slot TINYINT NOT NULL PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        city VARCHAR(80) NOT NULL,
        text VARCHAR(600) NOT NULL,
        stars TINYINT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS site_records (
        room_slug VARCHAR(32) NOT NULL,
        `rank` TINYINT NOT NULL,
        team VARCHAR(80) NOT NULL,
        time CHAR(5) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (room_slug, `rank`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS opening_periods (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        period_date DATE NOT NULL,
        start_minute SMALLINT UNSIGNED NOT NULL,
        end_minute SMALLINT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_period_date (period_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    mt_ensure_closed_slots_schema($pdo);
    mt_ensure_bookings_schema($pdo);
    mt_retire_slot_tables($pdo);

    $count = (int) $pdo->query('SELECT COUNT(*) FROM site_reviews')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare('INSERT INTO site_reviews (slot, name, city, text, stars) VALUES (?,?,?,?,?)');
        $stmt->execute([1, 'Élodie M.', 'Albi', "Une immersion incroyable ! Le bureau du directeur est bluffant de réalisme et les énigmes sont diaboliquement bien pensées. On a adhéré du début à la fin.", 5]);
        $stmt->execute([2, 'Thomas R.', 'Toulouse', "Le Vaisseau Fantôme nous a littéralement transportés. Un décor digne d'un film, une ambiance à frissonner et un game master au top. On reviendra !", 5]);
        $stmt->execute([3, 'Famille Garcia', 'Castres', "Parfait en famille : nos enfants de 11 et 14 ans ont participé à toutes les fouilles. Une heure passée beaucoup, beaucoup trop vite !", 5]);
    }
    $countR = (int) $pdo->query('SELECT COUNT(*) FROM site_records')->fetchColumn();
    if ($countR === 0) {
        $stmt = $pdo->prepare('INSERT INTO site_records (room_slug, `rank`, team, time) VALUES (?,?,?,?)');
        $stmt->execute(['directeur', 1, 'Les Limiers de Cordes', '38:42']);
        $stmt->execute(['directeur', 2, 'Section Enquête', '41:07']);
        $stmt->execute(['directeur', 3, 'Les Insoumis', '44:55']);
        $stmt->execute(['vaisseau', 1, "L'Équipage du Tarn", '39:18']);
        $stmt->execute(['vaisseau', 2, 'Les Moussaillons', '42:51']);
        $stmt->execute(['vaisseau', 3, 'Cap sur la Victoire', '47:03']);
    }
    $ready = true;
}

function mt_read_content(PDO $pdo): array {
    mt_ensure_schema($pdo);
    $reviews = $pdo->query('SELECT slot, name, city, text, stars FROM site_reviews ORDER BY slot ASC')->fetchAll();
    $rows = $pdo->query('SELECT room_slug, `rank`, team, time FROM site_records ORDER BY room_slug ASC, `rank` ASC')->fetchAll();
    $records = ['directeur' => [], 'vaisseau' => []];
    foreach ($rows as $row) {
        $slug = $row['room_slug'];
        if (!isset($records[$slug])) {
            continue;
        }
        $records[$slug][] = [
            'rank' => (int) $row['rank'],
            'team' => $row['team'],
            'time' => $row['time'],
        ];
    }
    foreach ($reviews as &$r) {
        $r['slot'] = (int) $r['slot'];
        $r['stars'] = (int) $r['stars'];
    }
    return ['reviews' => $reviews, 'records' => $records];
}

function mt_write_content(PDO $pdo, array $value): void {
    mt_ensure_schema($pdo);
    $pdo->beginTransaction();
    try {
        $upR = $pdo->prepare('INSERT INTO site_reviews (slot, name, city, text, stars) VALUES (?,?,?,?,?)
            ON DUPLICATE KEY UPDATE name=VALUES(name), city=VALUES(city), text=VALUES(text), stars=VALUES(stars)');
        foreach ($value['reviews'] as $r) {
            $upR->execute([$r['slot'], $r['name'], $r['city'], $r['text'], $r['stars']]);
        }
        $upT = $pdo->prepare('INSERT INTO site_records (room_slug, `rank`, team, time) VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE team=VALUES(team), time=VALUES(time)');
        foreach ($value['records'] as $slug => $rows) {
            foreach ($rows as $row) {
                $upT->execute([$slug, $row['rank'], $row['team'], $row['time']]);
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
