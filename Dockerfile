# =============================================================
# Vpanel — Dockerfile production (Coolify-ready)
# =============================================================
# Stage 1 : build du frontend React/Vite
# Stage 2 : runtime Nginx + PHP-FPM (Alpine)
#
# Les variables VITE_* sont intégrées au bundle au moment du
# build. Dans Coolify, passez-les en "Build Arguments".
# =============================================================

# ─── Stage 1 : builder Node.js ───────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copie des manifestes en premier pour bénéficier du cache Docker
COPY package*.json ./

# Installation propre des dépendances (utilise package-lock.json)
RUN npm ci

# Copie du code source complet
COPY . .

# ── Variables Vite (baked at build time) ──────────────────────
# Passées via --build-arg dans Coolify / docker build
ARG VITE_APP_MODE=production
ARG VITE_APP_BASE=/
ARG VITE_APP_LOCALE=fr-FR
ARG VITE_APP_LOCALES=fr-FR,en-US
ARG VITE_APP_HOSTNAME=http://localhost
ARG VITE_APP_URL=http://localhost/
ARG VITE_APP_API_URL=http://localhost/api/
ARG VITE_SERVER_PORT=80
ARG VITE_USE_AUTH=false
ARG VITE_APP_VERSION_RANGE=>1.3.0
ARG VITE_DEFAULT_STEPSIZE=18
ARG VITE_DEFAULT_STEPSPERROW=13
ARG VITE_DEFAULT_ROWS=4
ARG VITE_DEFAULT_ROWHEIGHT=29
ARG VITE_DEFAULT_ID=Q
ARG VITE_DEFAULT_ICON=
ARG VITE_DEFAULT_TEXT=
ARG VITE_DEFAULT_DESC=
ARG VITE_DEFAULT_SHOWID=true
ARG VITE_DEFAULT_SHOWICON=true
ARG VITE_DEFAULT_SHOWTEXT=true
ARG VITE_DEFAULT_PRINT_EMPTY=true
ARG VITE_DEFAULT_PROJECT_NAME=Nouveau projet
ARG VITE_DEFAULT_PROJECT_TYPE=R
ARG VITE_DEFAULT_VREF=230
ARG VITE_ROWS_MIN=1
ARG VITE_ROWS_MAX=15
ARG VITE_HEIGHT_MIN=10
ARG VITE_HEIGHT_MAX=50
ARG VITE_ALLOWED_MODULES=13,18,24
ARG VITE_AUTOLOGOUT_TIMEOUT=10
ARG VITE_PROJECTS_AUTOSAVE_MINUTES=2

# Exposition des ARG en ENV pour que Vite puisse les lire
ENV VITE_APP_MODE=$VITE_APP_MODE \
    VITE_APP_BASE=$VITE_APP_BASE \
    VITE_APP_LOCALE=$VITE_APP_LOCALE \
    VITE_APP_LOCALES=$VITE_APP_LOCALES \
    VITE_APP_HOSTNAME=$VITE_APP_HOSTNAME \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_APP_API_URL=$VITE_APP_API_URL \
    VITE_SERVER_PORT=$VITE_SERVER_PORT \
    VITE_USE_AUTH=$VITE_USE_AUTH \
    VITE_APP_VERSION_RANGE=$VITE_APP_VERSION_RANGE \
    VITE_DEFAULT_STEPSIZE=$VITE_DEFAULT_STEPSIZE \
    VITE_DEFAULT_STEPSPERROW=$VITE_DEFAULT_STEPSPERROW \
    VITE_DEFAULT_ROWS=$VITE_DEFAULT_ROWS \
    VITE_DEFAULT_ROWHEIGHT=$VITE_DEFAULT_ROWHEIGHT \
    VITE_DEFAULT_ID=$VITE_DEFAULT_ID \
    VITE_DEFAULT_ICON=$VITE_DEFAULT_ICON \
    VITE_DEFAULT_TEXT=$VITE_DEFAULT_TEXT \
    VITE_DEFAULT_DESC=$VITE_DEFAULT_DESC \
    VITE_DEFAULT_SHOWID=$VITE_DEFAULT_SHOWID \
    VITE_DEFAULT_SHOWICON=$VITE_DEFAULT_SHOWICON \
    VITE_DEFAULT_SHOWTEXT=$VITE_DEFAULT_SHOWTEXT \
    VITE_DEFAULT_PRINT_EMPTY=$VITE_DEFAULT_PRINT_EMPTY \
    VITE_DEFAULT_PROJECT_NAME=$VITE_DEFAULT_PROJECT_NAME \
    VITE_DEFAULT_PROJECT_TYPE=$VITE_DEFAULT_PROJECT_TYPE \
    VITE_DEFAULT_VREF=$VITE_DEFAULT_VREF \
    VITE_ROWS_MIN=$VITE_ROWS_MIN \
    VITE_ROWS_MAX=$VITE_ROWS_MAX \
    VITE_HEIGHT_MIN=$VITE_HEIGHT_MIN \
    VITE_HEIGHT_MAX=$VITE_HEIGHT_MAX \
    VITE_ALLOWED_MODULES=$VITE_ALLOWED_MODULES \
    VITE_AUTOLOGOUT_TIMEOUT=$VITE_AUTOLOGOUT_TIMEOUT \
    VITE_PROJECTS_AUTOSAVE_MINUTES=$VITE_PROJECTS_AUTOSAVE_MINUTES

# Build (prebuild:coolify copie schema_functions.json → public/api/libs/toPdf/assets)
RUN npm run build:coolify


# ─── Stage 2 : runtime PHP-FPM + Nginx ───────────────────────
FROM php:8.2-fpm-alpine

# Outils système + extensions PHP nécessaires
RUN apk add --no-cache \
        nginx \
        supervisor \
        curl \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        icu-dev \
        sqlite \
        sqlite-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        gd \
        pdo \
        pdo_sqlite \
        intl \
    && rm -rf /var/cache/apk/* \
    && rm -f /usr/local/etc/php-fpm.d/www.conf*

# Répertoires de travail
RUN mkdir -p \
        /var/www/html \
        /var/www/api \
        /run/nginx \
        /var/log/nginx \
        /var/log/supervisor \
        /var/log/php-fpm

# ── Copie des artefacts build ─────────────────────────────────
# Frontend compilé (dist/)
COPY --from=builder /app/dist /var/www/html

# Backend PHP (public/api/), inclut libs, FPDF, PHPMailer, etc.
COPY public/api /var/www/api

# ── Configuration des services ────────────────────────────────
COPY docker/nginx.conf        /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf  /etc/supervisor/conf.d/supervisord.conf
COPY docker/php-fpm.conf      /usr/local/etc/php-fpm.d/zzz-vpanel.conf

# Entrypoint : génère constants.php depuis les variables d'env
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/init.sqlite.sql /init.sqlite.sql
RUN chmod +x /entrypoint.sh

# Permissions
RUN chown -R www-data:www-data /var/www \
    && chmod -R 755 /var/www/html \
    && chmod -R 750 /var/www/api \
    && chown -R www-data:www-data /var/log/php-fpm \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /run/nginx

# ── Métadonnées ───────────────────────────────────────────────
EXPOSE 3000

# Healthcheck léger : myip.php ne requiert pas de base de données
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsSL "http://127.0.0.1:3000/api/myip.php" -o /dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
