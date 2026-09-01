<?php
declare(strict_types=1);

function mt_validate_content(array $data): array {
    $reviewsIn = $data['reviews'] ?? null;
    $recordsIn = $data['records'] ?? null;
    if (!is_array($reviewsIn) || count($reviewsIn) !== 3) {
        return ['ok' => false, 'error' => 'Il faut exactement 3 avis.', 'value' => null];
    }
    if (!is_array($recordsIn) || !isset($recordsIn['directeur'], $recordsIn['vaisseau'])) {
        return ['ok' => false, 'error' => 'Records manquants pour une salle.', 'value' => null];
    }
    $reviews = [];
    $slots = [];
    foreach ($reviewsIn as $row) {
        if (!is_array($row)) {
            return ['ok' => false, 'error' => 'Avis invalide.', 'value' => null];
        }
        $slot = (int) ($row['slot'] ?? 0);
        $name = trim((string) ($row['name'] ?? ''));
        $city = trim((string) ($row['city'] ?? ''));
        $text = trim((string) ($row['text'] ?? ''));
        $starsRaw = $row['stars'] ?? null;
        if (!is_int($starsRaw)) {
            return ['ok' => false, 'error' => 'La note doit être entre 1 et 5 étoiles.', 'value' => null];
        }
        $stars = $starsRaw;
        if ($slot < 1 || $slot > 3 || isset($slots[$slot])) {
            return ['ok' => false, 'error' => 'Slots d’avis invalides.', 'value' => null];
        }
        if ($name === '' || $city === '' || $text === '') {
            return ['ok' => false, 'error' => 'Nom, ville et texte sont obligatoires.', 'value' => null];
        }
        if (mb_strlen($name) > 80 || mb_strlen($city) > 80 || mb_strlen($text) > 600) {
            return ['ok' => false, 'error' => 'Un champ avis est trop long.', 'value' => null];
        }
        if ($stars < 1 || $stars > 5) {
            return ['ok' => false, 'error' => 'La note doit être entre 1 et 5 étoiles.', 'value' => null];
        }
        $slots[$slot] = true;
        $reviews[] = compact('slot', 'name', 'city', 'text', 'stars');
    }
    usort($reviews, fn($a, $b) => $a['slot'] <=> $b['slot']);

    $records = [];
    foreach (['directeur', 'vaisseau'] as $slug) {
        $rows = $recordsIn[$slug] ?? null;
        if (!is_array($rows) || count($rows) !== 3) {
            return ['ok' => false, 'error' => 'Il faut exactement 3 records par salle.', 'value' => null];
        }
        $ranks = [];
        $clean = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                return ['ok' => false, 'error' => 'Record invalide.', 'value' => null];
            }
            $rank = (int) ($row['rank'] ?? 0);
            $team = trim((string) ($row['team'] ?? ''));
            $time = trim((string) ($row['time'] ?? ''));
            if ($rank < 1 || $rank > 3 || isset($ranks[$rank])) {
                return ['ok' => false, 'error' => 'Rangs de records invalides.', 'value' => null];
            }
            if ($team === '' || mb_strlen($team) > 80) {
                return ['ok' => false, 'error' => 'Nom d’équipe obligatoire (max 80).', 'value' => null];
            }
            if (!preg_match('/^[0-5][0-9]:[0-5][0-9]$/', $time)) {
                return ['ok' => false, 'error' => 'Temps au format MM:SS (00:00–59:59).', 'value' => null];
            }
            $ranks[$rank] = true;
            $clean[] = compact('rank', 'team', 'time');
        }
        usort($clean, fn($a, $b) => $a['rank'] <=> $b['rank']);
        $records[$slug] = $clean;
    }
    return ['ok' => true, 'error' => null, 'value' => ['reviews' => $reviews, 'records' => $records]];
}

function mt_validate_guest_name(string $name): array {
    $name = trim($name);
    $letters = preg_match_all('/\p{L}/u', $name);
    $okChars = (bool) preg_match("/^[\\p{L}\\p{M}][\\p{L}\\p{M}\\s'\\x{2019}-]*$/u", $name);
    if ($name === '' || mb_strlen($name) > 120 || $letters < 2 || !$okChars) {
        return ['ok' => false, 'error' => 'Indiquez un nom (au moins 2 lettres).', 'value' => null];
    }
    return ['ok' => true, 'error' => null, 'value' => $name];
}

function mt_validate_guest_email(string $email): array {
    $email = trim($email);
    if ($email === '' || mb_strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'E-mail invalide.', 'value' => null];
    }
    return ['ok' => true, 'error' => null, 'value' => $email];
}

function mt_validate_guest_phone(string $phone): array {
    $phone = trim($phone);
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if (
        $phone === ''
        || mb_strlen($phone) > 40
        || !preg_match('/^[0-9+\s().\-]+$/', $phone)
        || strlen($digits) < 8
    ) {
        return ['ok' => false, 'error' => 'Numéro de téléphone invalide.', 'value' => null];
    }
    return ['ok' => true, 'error' => null, 'value' => $phone];
}

