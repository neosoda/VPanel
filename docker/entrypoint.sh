#!/bin/sh
# =============================================================
# entrypoint.sh — Vpanel
# Génère les fichiers constants.*.php depuis les variables
# d'environnement, initialise SQLite puis démarre supervisord.
# =============================================================
set -e

# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
log() { echo "[entrypoint] $*"; }

bool_php() {
    # Convertit "true"/"1"/"yes" en "true" PHP, tout le reste en "false"
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        true|1|yes) echo "true" ;;
        *)          echo "false" ;;
    esac
}

# ──────────────────────────────────────────────────────────────
# Valeurs par défaut des variables d'environnement
# ──────────────────────────────────────────────────────────────
SQLITE_DB_PATH="${SQLITE_DB_PATH:-/var/www/api/data/vpanel.sqlite}"

SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_AUTH="$(bool_php "${SMTP_AUTH:-false}")"
SMTP_USERNAME="${SMTP_USERNAME:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
SMTP_SECURE="${SMTP_SECURE:-}"
SMTP_FROM="${SMTP_FROM:-}"

STATS_IGNORE_LOCALHOST="$(bool_php "${STATS_IGNORE_LOCALHOST:-false}")"
STATS_VISITS_INTERVAL="${STATS_VISITS_INTERVAL:-30 minutes}"

# Hostname nu (sans scheme) exposé pour la validation du Referer PHP
APP_HOSTNAME="${APP_HOSTNAME:-localhost}"

# ──────────────────────────────────────────────────────────────
# Initialisation SQLite
# ──────────────────────────────────────────────────────────────
SQLITE_DIR=$(dirname "$SQLITE_DB_PATH")
if [ ! -d "$SQLITE_DIR" ]; then
    log "Création du répertoire $SQLITE_DIR..."
    mkdir -p "$SQLITE_DIR"
    chown www-data:www-data "$SQLITE_DIR"
fi

if [ ! -f "$SQLITE_DB_PATH" ]; then
    log "Initialisation de la base SQLite dans $SQLITE_DB_PATH..."
    touch "$SQLITE_DB_PATH"
    if [ -f "/init.sqlite.sql" ]; then
        sqlite3 "$SQLITE_DB_PATH" < /init.sqlite.sql
        log "Schéma SQLite importé avec succès."
    fi
    chown www-data:www-data "$SQLITE_DB_PATH"
    chmod 660 "$SQLITE_DB_PATH"
else
    log "Base de données SQLite trouvée à l'emplacement $SQLITE_DB_PATH."
fi

# ──────────────────────────────────────────────────────────────
# Génération des fichiers constants.*.php
# ──────────────────────────────────────────────────────────────
generate_constants() {
    local MODE="$1"
    local DEST="/var/www/api/libs/constants.${MODE}.php"

    log "Génération de ${DEST}..."

    cat > "$DEST" << PHPEOF
<?php
// Auto-généré par docker/entrypoint.sh au démarrage du conteneur.
// Ne pas éditer manuellement.

// Base de données
define('SQLITE_DB_PATH', '${SQLITE_DB_PATH}');

// SMTP (optionnel)
define('SMTP_HOST',     '${SMTP_HOST}');
define('SMTP_PORT',     ${SMTP_PORT});
define('SMTP_AUTH',     ${SMTP_AUTH});
define('SMTP_USERNAME', '${SMTP_USERNAME}');
define('SMTP_PASSWORD', '${SMTP_PASSWORD}');
define('SMTP_SECURE',   '${SMTP_SECURE}');
define('SMTP_FROM',     '${SMTP_FROM}');

// Statistiques
define('STATS_IGNORE_LOCALHOST', ${STATS_IGNORE_LOCALHOST});
define('STATS_VISITS_INTERVAL',  '${STATS_VISITS_INTERVAL}');

// Hôtes autorisés pour la validation du Referer (ajoutés à la liste par défaut)
define('ALLOWED_HOSTS', [
    '${APP_HOSTNAME}',
]);
PHPEOF

    chown www-data:www-data "$DEST"
    chmod 640 "$DEST"
    log "${DEST} généré."
}

generate_constants "production"
generate_constants "development"

# ──────────────────────────────────────────────────────────────
# Démarrage des services via supervisord
# ──────────────────────────────────────────────────────────────
log "Démarrage des services (Nginx + PHP-FPM)..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
