<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

mt_json_out(410, ['error' => 'Les créneaux ne sont plus gérés. Utilise les plages et les réservations.']);
