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

function mt_ensure_schema(PDO $pdo): void {
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
