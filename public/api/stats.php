<?php

/**
 * Vpanel - Générateur d'étiquettes pour tableaux et armoires électriques
 * Copyright (C) 2024-2026 Neosoda
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

declare(strict_types=1);

function SQL2DateTimeUTC(string $sqlDate, string $format = 'Y-m-d H:i:s'): \DateTime
{
    return \DateTime::createFromFormat($format, $sqlDate, new \DateTimeZone('UTC'));
}

function addToDateTime(\DateTime $dt, string $intervalString, bool $isClone = true): \DateTime
{
    return (clone $dt)->add(\DateInterval::createFromDateString($intervalString));
}

function dateTimeFrom(string $from): \DateTime
{
    return new \DateTime($from, new \DateTimeZone("UTC"));
}

function ensureStatsSchema(\PDO $db): void
{
    $tableHasColumn = static function (string $tableName, string $columnName) use ($db): bool {
        $stmt = $db->query("PRAGMA table_info({$tableName})");
        $columns = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($columns as $column) {
            if (($column['name'] ?? '') === $columnName) {
                return true;
            }
        }
        return false;
    };

    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS stats_allowed_structs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL DEFAULT ''
);
SQL);

    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS stats_allowed_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL DEFAULT ''
);
SQL);

    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS stats_allowed_choices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL DEFAULT ''
);
SQL);

    if (!$tableHasColumn('stats_allowed_structs', 'description')) {
        $db->exec("ALTER TABLE stats_allowed_structs ADD COLUMN description VARCHAR(255) NOT NULL DEFAULT ''");
    }
    if (!$tableHasColumn('stats_allowed_actions', 'description')) {
        $db->exec("ALTER TABLE stats_allowed_actions ADD COLUMN description VARCHAR(255) NOT NULL DEFAULT ''");
    }
    if (!$tableHasColumn('stats_allowed_choices', 'description')) {
        $db->exec("ALTER TABLE stats_allowed_choices ADD COLUMN description VARCHAR(255) NOT NULL DEFAULT ''");
    }

    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS stats_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip VARCHAR(45) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT '',
    regionName VARCHAR(100) NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT '',
    timezone VARCHAR(100) NOT NULL DEFAULT '',
    type VARCHAR(10) NOT NULL DEFAULT 'user',
    struct VARCHAR(50) NOT NULL DEFAULT '',
    url TEXT NOT NULL,
    ua TEXT NOT NULL,
    rfr TEXT NOT NULL,
    datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
SQL);
    $db->exec("CREATE INDEX IF NOT EXISTS idx_ip_url ON stats_visits (ip, url);");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_datetime ON stats_visits (datetime);");

    $db->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS stats_visits_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL,
    date DATE NOT NULL,
    counters TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (visit_id) REFERENCES stats_visits(id) ON DELETE CASCADE
);
SQL);
    $db->exec("CREATE INDEX IF NOT EXISTS idx_visit_date ON stats_visits_details (visit_id, date);");

    $stmt = $db->prepare("INSERT OR IGNORE INTO stats_allowed_structs (key, description) VALUES (?, ?)");
    foreach ([['web', 'Web'], ['app', 'Application']] as [$key, $description]) {
        $stmt->execute([$key, $description]);
    }

    $stmt = $db->prepare("INSERT OR IGNORE INTO stats_allowed_actions (key, description) VALUES (?, ?)");
    foreach ([['create', 'Créations de projets'], ['import', 'Imports de projets'], ['export', 'Exports de projets'], ['print', 'Impressions']] as [$key, $description]) {
        $stmt->execute([$key, $description]);
    }

    $stmt = $db->prepare("INSERT OR IGNORE INTO stats_allowed_choices (key, description) VALUES (?, ?)");
    foreach ([['theme', 'Thèmes utilisés'], ['print', 'Types d\'impressions'], ['print_format', 'Formats d\'impression']] as [$key, $description]) {
        $stmt->execute([$key, $description]);
    }

    $db->exec("UPDATE stats_allowed_structs SET description = 'Web' WHERE key = 'web' AND (description IS NULL OR description = '')");
    $db->exec("UPDATE stats_allowed_structs SET description = 'Application' WHERE key = 'app' AND (description IS NULL OR description = '')");

    $db->exec("UPDATE stats_allowed_actions SET description = 'Créations de projets' WHERE key = 'create' AND (description IS NULL OR description = '')");
    $db->exec("UPDATE stats_allowed_actions SET description = 'Imports de projets' WHERE key = 'import' AND (description IS NULL OR description = '')");
    $db->exec("UPDATE stats_allowed_actions SET description = 'Exports de projets' WHERE key = 'export' AND (description IS NULL OR description = '')");
    $db->exec("UPDATE stats_allowed_actions SET description = 'Impressions' WHERE key = 'print' AND (description IS NULL OR description = '')");

    $db->exec("UPDATE stats_allowed_choices SET description = 'Thèmes utilisés' WHERE key = 'theme' AND (description IS NULL OR description = '')");
    $db->exec("UPDATE stats_allowed_choices SET description = 'Types d''impressions' WHERE key = 'print' AND (description IS NULL OR description = '')");
    $db->exec("UPDATE stats_allowed_choices SET description = 'Formats d''impression' WHERE key = 'print_format' AND (description IS NULL OR description = '')");
}

ensureStatsSchema(DB);
define('STATS_ALLOWED', !STATS_IGNORE_LOCALHOST || (STATS_IGNORE_LOCALHOST && !CLIENT_FROM_LOCALHOST));

$stmt = DB->prepare("SELECT * FROM stats_allowed_structs");
$stmt->execute();
$result = $stmt->fetchAll(\PDO::FETCH_ASSOC);
define('STATS_ALLOWED_STRUCTURES_FULL', $result);
define('STATS_ALLOWED_STRUCTURES', array_map(fn($i) => $i['key'], $result));
$statsStructure = isset($_GET['s']) ? strtolower(rawurldecode(trim($_GET['s']))) : '';
define('STATS_STRUCTURE_ALLOWED', in_array($statsStructure, STATS_ALLOWED_STRUCTURES));
define('STATS_STRUCTURE', STATS_STRUCTURE_ALLOWED ? $statsStructure : '');

$stmt = DB->prepare("SELECT * FROM stats_allowed_actions");
$stmt->execute();
$result = $stmt->fetchAll(\PDO::FETCH_ASSOC);
define('STATS_ALLOWED_ACTIONS_FULL', $result);
define('STATS_ALLOWED_ACTIONS', array_map(fn($i) => $i['key'], $result));
$statsAction = isset($_GET['a']) ? strtolower(rawurldecode(trim($_GET['a']))) : '';
define('STATS_ACTION_ALLOWED', in_array($statsAction, STATS_ALLOWED_ACTIONS, true));
define('STATS_ACTION', STATS_ACTION_ALLOWED ? $statsAction : '');

$stmt = DB->prepare("SELECT * FROM stats_allowed_choices");
$stmt->execute();
$result = $stmt->fetchAll(\PDO::FETCH_ASSOC);
define('STATS_ALLOWED_CHOICES_FULL', $result);
define('STATS_ALLOWED_CHOICES', array_map(fn($i) => $i['key'], $result));
$statsChoice = isset($_GET['c']) ? strtolower(rawurldecode(trim($_GET['c']))) : '';
define('STATS_CHOICE_ALLOWED', in_array($statsChoice, STATS_ALLOWED_CHOICES, true));
define('STATS_CHOICE', STATS_CHOICE_ALLOWED ? $statsChoice : '');

define('STATS_ALLOWED_PERIODS', [
    '-1d' => ['start' => dateTimeFrom('yesterday'), 'end' => dateTimeFrom('yesterday'), 'text' => "Hier"],
    'd' => ['start' => dateTimeFrom('today'), 'end' => dateTimeFrom('today'), 'text' => "Aujourd'hui"],
    '-7d' => ['start' => dateTimeFrom('today -7 days'), 'end' => dateTimeFrom('today'), 'text' => "Les 7 derniers jours"],
    'w' => ['start' => dateTimeFrom('Monday this week'), 'end' => dateTimeFrom('Sunday this week'), 'text' => "Cette semaine"],
    '-w' => ['start' => dateTimeFrom('Monday last week'), 'end' => dateTimeFrom('Sunday last week'), 'text' => "La semaine dernière"],
    '-30d' => ['start' => dateTimeFrom('today -30 days'), 'end' => dateTimeFrom('today'), 'text' => "Les 30 derniers jours"],
    '-60d' => ['start' => dateTimeFrom('today -60 days'), 'end' => dateTimeFrom('today'), 'text' => "Les 60 derniers jours"],
    '-90d' => ['start' => dateTimeFrom('today -90 days'), 'end' => dateTimeFrom('today'), 'text' => "Les 90 derniers jours"],
    'm' => ['start' => dateTimeFrom('first day of this month'), 'end' => dateTimeFrom(from: 'last day of this month'), 'text' => "Ce mois ci"],
    '-m' => ['start' => dateTimeFrom('first day of last month'), 'end' => dateTimeFrom(from: 'last day of last month'), 'text' => "Le mois dernier"],
    'y' => ['start' => dateTimeFrom('first day of this year'), 'end' => dateTimeFrom(from: 'last day of this year'), 'text' => "Cette année"],
    '-y' => ['start' => dateTimeFrom('first day of last year'), 'end' => dateTimeFrom(from: 'last day of last year'), 'text' => "L'année dernière"],
]);

define('STATS_ALLOWED_RESOLUTIONS', [
    'h' => ['text' => 'Moyennes par heures'],
    'd' => ['text' => 'Moyennes par jours']
]);
