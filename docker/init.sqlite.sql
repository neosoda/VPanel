-- =============================================================
-- Vpanel — Initialisation du schéma SQLite
-- Exécuté automatiquement par entrypoint.sh si la base 
-- SQLite n'existe pas.
-- =============================================================

PRAGMA foreign_keys = ON;

-- ─── Structures de statistiques autorisées ───────────────────
CREATE TABLE IF NOT EXISTS `stats_allowed_structs` (
    `id`  INTEGER PRIMARY KEY AUTOINCREMENT,
    `key` VARCHAR(50)  NOT NULL UNIQUE,
    `description` VARCHAR(255) NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO `stats_allowed_structs` (`key`, `description`) VALUES
    ('web', 'Web'),
    ('app', 'Application');

-- ─── Actions de statistiques autorisées ──────────────────────
CREATE TABLE IF NOT EXISTS `stats_allowed_actions` (
    `id`  INTEGER PRIMARY KEY AUTOINCREMENT,
    `key` VARCHAR(50)  NOT NULL UNIQUE,
    `description` VARCHAR(255) NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO `stats_allowed_actions` (`key`, `description`) VALUES
    ('create', 'Créations de projets'),
    ('import', 'Imports de projets'),
    ('export', 'Exports de projets'),
    ('print', 'Impressions');

-- ─── Choix de statistiques autorisés ─────────────────────────
CREATE TABLE IF NOT EXISTS `stats_allowed_choices` (
    `id`  INTEGER PRIMARY KEY AUTOINCREMENT,
    `key` VARCHAR(50)  NOT NULL UNIQUE,
    `description` VARCHAR(255) NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO `stats_allowed_choices` (`key`, `description`) VALUES
    ('theme', 'Thèmes utilisés'),
    ('print', 'Types d''impressions'),
    ('print_format', 'Formats d''impression');

-- ─── Visites ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `stats_visits` (
    `id`         INTEGER PRIMARY KEY AUTOINCREMENT,
    `ip`         VARCHAR(45)   NOT NULL,
    `country`    VARCHAR(100)  NOT NULL DEFAULT '',
    `regionName` VARCHAR(100)  NOT NULL DEFAULT '',
    `city`       VARCHAR(100)  NOT NULL DEFAULT '',
    `timezone`   VARCHAR(100)  NOT NULL DEFAULT '',
    `type`       VARCHAR(10)   NOT NULL DEFAULT 'user',
    `struct`     VARCHAR(50)   NOT NULL DEFAULT '',
    `url`        TEXT          NOT NULL,
    `ua`         TEXT          NOT NULL,
    `rfr`        TEXT          NOT NULL,
    `datetime`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS `idx_ip_url` ON `stats_visits` (`ip`, `url`);
CREATE INDEX IF NOT EXISTS `idx_datetime` ON `stats_visits` (`datetime`);

-- ─── Détail des visites (compteurs par heure/jour) ───────────
CREATE TABLE IF NOT EXISTS `stats_visits_details` (
    `id`       INTEGER PRIMARY KEY AUTOINCREMENT,
    `visit_id` INTEGER NOT NULL,
    `date`     DATE    NOT NULL,
    `counters` TEXT    NOT NULL DEFAULT '{}',
    FOREIGN KEY (`visit_id`) REFERENCES `stats_visits`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_visit_date` ON `stats_visits_details` (`visit_id`, `date`);
