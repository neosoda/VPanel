# Multi-stage build optimisé pour Vpanel + Coolify
# Stage 1: Build frontend (Node.js + Vite)
FROM node:20-alpine AS builder

WORKDIR /build

# Build-time arguments for Vite configuration
# These defaults make Docker builds reproducible even when no .env file is copied.
ARG VITE_APP_MODE=production
ARG VITE_SERVER_PORT=5173
ARG VITE_IS_LOCAL=false
ARG VITE_APP_BASE=/
ARG VITE_APP_LOCALE=fr-FR
ARG VITE_APP_HOSTNAME=https://example.com
ARG VITE_APP_URL=https://example.com/
ARG VITE_APP_API_URL=/api/
ARG VITE_APP_VERSION_RANGE=">1.3.0"
ARG VITE_DEFAULT_STEPSIZE=18
ARG VITE_DEFAULT_STEPSPERROW=13
ARG VITE_DEFAULT_ROWS=4
ARG VITE_DEFAULT_ROWHEIGHT=29
ARG VITE_DEFAULT_ID=Q
ARG VITE_DEFAULT_ICON=
ARG VITE_DEFAULT_TEXT=
ARG VITE_DEFAULT_DESC=
ARG VITE_DEFAULT_PRINT_EMPTY=true
ARG VITE_DEFAULT_PROJECT_NAME="Nouveau projet"
ARG VITE_DEFAULT_PROJECT_TYPE=R
ARG VITE_DEFAULT_VREF=230
ARG VITE_ROWS_MIN=1
ARG VITE_ROWS_MAX=15
ARG VITE_HEIGHT_MIN=10
ARG VITE_HEIGHT_MAX=50
ARG VITE_ALLOWED_MODULES=13,18,24
ARG VITE_USE_AUTH=false
ARG VITE_AUTOLOGOUT_TIMEOUT=10
ARG VITE_PROJECTS_AUTOSAVE_MINUTES=2

# Make available to RUN commands
ENV VITE_APP_MODE=${VITE_APP_MODE} \
    VITE_SERVER_PORT=${VITE_SERVER_PORT} \
    VITE_IS_LOCAL=${VITE_IS_LOCAL} \
    VITE_APP_BASE=${VITE_APP_BASE} \
    VITE_APP_LOCALE=${VITE_APP_LOCALE} \
    VITE_APP_HOSTNAME=${VITE_APP_HOSTNAME} \
    VITE_APP_URL=${VITE_APP_URL} \
    VITE_APP_API_URL=${VITE_APP_API_URL} \
    VITE_APP_VERSION_RANGE=${VITE_APP_VERSION_RANGE} \
    VITE_DEFAULT_STEPSIZE=${VITE_DEFAULT_STEPSIZE} \
    VITE_DEFAULT_STEPSPERROW=${VITE_DEFAULT_STEPSPERROW} \
    VITE_DEFAULT_ROWS=${VITE_DEFAULT_ROWS} \
    VITE_DEFAULT_ROWHEIGHT=${VITE_DEFAULT_ROWHEIGHT} \
    VITE_DEFAULT_ID=${VITE_DEFAULT_ID} \
    VITE_DEFAULT_ICON=${VITE_DEFAULT_ICON} \
    VITE_DEFAULT_TEXT=${VITE_DEFAULT_TEXT} \
    VITE_DEFAULT_DESC=${VITE_DEFAULT_DESC} \
    VITE_DEFAULT_PRINT_EMPTY=${VITE_DEFAULT_PRINT_EMPTY} \
    VITE_DEFAULT_PROJECT_NAME=${VITE_DEFAULT_PROJECT_NAME} \
    VITE_DEFAULT_PROJECT_TYPE=${VITE_DEFAULT_PROJECT_TYPE} \
    VITE_DEFAULT_VREF=${VITE_DEFAULT_VREF} \
    VITE_ROWS_MIN=${VITE_ROWS_MIN} \
    VITE_ROWS_MAX=${VITE_ROWS_MAX} \
    VITE_HEIGHT_MIN=${VITE_HEIGHT_MIN} \
    VITE_HEIGHT_MAX=${VITE_HEIGHT_MAX} \
    VITE_ALLOWED_MODULES=${VITE_ALLOWED_MODULES} \
    VITE_USE_AUTH=${VITE_USE_AUTH} \
    VITE_AUTOLOGOUT_TIMEOUT=${VITE_AUTOLOGOUT_TIMEOUT} \
    VITE_PROJECTS_AUTOSAVE_MINUTES=${VITE_PROJECTS_AUTOSAVE_MINUTES}

# Copier package files (package-lock.json requis par npm ci)
COPY package.json package-lock.json package-base.json app-config.json ./
COPY app-config-compiler.cjs ./

# Installer TOUTES les dépendances (--omit=optional interdit : @rollup/rollup-linux-x64-musl requis par Vite sur Alpine/musl)
RUN npm ci --include=dev

# Copier source
COPY src ./src
COPY public/api ./public/api
COPY index.html vite.config.js .eslintrc.cjs ./

# Build app pour Coolify (compile config, copy assets, then build with Vite)
# Using npx vite directly to avoid npm script resolution issues in cached layers
RUN echo "Building Vpanel with:" && \
    echo "  VITE_APP_BASE=${VITE_APP_BASE}" && \
    echo "  VITE_APP_URL=${VITE_APP_URL}" && \
    echo "  VITE_APP_API_URL=${VITE_APP_API_URL}" && \
    echo "  VITE_USE_AUTH=${VITE_USE_AUTH}" && \
    node app-config-compiler.cjs && \
    mkdir -p public/api/libs/toPdf/assets/ && \
    cp -p src/schema_functions.json public/api/libs/toPdf/assets/schema_functions.json && \
    NODE_ENV=production ./node_modules/.bin/vite build --mode coolify

# Verify build
RUN if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then \
      echo "ERROR: Build failed - dist directory empty"; \
      exit 1; \
    fi && \
    echo "✓ Build successful - $(du -sh dist | cut -f1)"

# Stage 2: Runtime PHP 8.2
FROM php:8.2-fpm-alpine

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    curl \
    wget \
    supervisor

# Use the official installer image to get the script (faster than downloading)
COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/

# Install PHP extensions required by runtime:
# - pdo_sqlite/sqlite3 for API stats storage
# - mbstring for PDF text formatting
# - gd/exif/fileinfo/zip/opcache for existing app features
# This is much faster and cleaner than manual compilation
RUN install-php-extensions gd exif fileinfo zip opcache mbstring pdo_sqlite sqlite3

# PHP Configuration for production
RUN cat > /usr/local/etc/php/conf.d/app.ini << 'PHP_INI'
upload_max_filesize = 50M
post_max_size = 50M
memory_limit = 512M
max_execution_time = 300
default_charset = "UTF-8"
date.timezone = UTC
expose_php = Off
display_errors = Off
log_errors = On
error_log = /proc/self/fd/2
display_startup_errors = Off
PHP_INI

# PHP-FPM defaults
ENV PHP_FPM_PM_MAX_CHILDREN=10 \
    PHP_FPM_PM_START_SERVERS=2 \
    PHP_FPM_PM_MIN_SPARE_SERVERS=1 \
    PHP_FPM_PM_MAX_SPARE_SERVERS=5 \
    PHP_APP_MODE=production \
    APP_HOSTNAME=localhost \
    SQLITE_DB_PATH=/app/public/data/vpanel.sqlite

# PHP-FPM Pool Configuration
RUN cat > /usr/local/etc/php-fpm.d/www.conf << 'PHPFPM_CONF'
[www]
user = www-data
group = www-data

pm = dynamic
pm.max_children = ${PHP_FPM_PM_MAX_CHILDREN}
pm.start_servers = ${PHP_FPM_PM_START_SERVERS}
pm.min_spare_servers = ${PHP_FPM_PM_MIN_SPARE_SERVERS}
pm.max_spare_servers = ${PHP_FPM_PM_MAX_SPARE_SERVERS}
pm.process_idle_timeout = 10s
pm.max_requests = 500

listen = 127.0.0.1:9000
listen.allowed_clients = 127.0.0.1
chdir = /app/public/api

access.log = /proc/self/fd/2
access.format = "%R - %u %t \"%m %r\" %s"

catch_workers_output = yes
decorate_workers_output = no
PHPFPM_CONF

WORKDIR /app

# Copy dist from builder (dist should never be empty)
COPY --from=builder /build/dist ./public

# Copy PHP backend API
COPY public/api ./public/api

# Ensure infos.json exists (fallback if not in dist)
RUN if [ ! -f ./public/infos.json ]; then \
      echo '{"version":"0.1beta","name":"Vpanel","description":"Générateur d'\''étiquettes"}' > ./public/infos.json; \
    fi

# (No-op: JSON files are already in ./public via COPY --from=builder)

# Set proper permissions
RUN mkdir -p /app/public/data && \
    chown -R www-data:www-data /app && \
    find /app/public -type f -exec chmod 644 {} \; && \
    find /app/public -type d -exec chmod 755 {} \;

# Nginx configuration for Vpanel SPA
RUN mkdir -p /etc/nginx/http.d && cat > /etc/nginx/http.d/default.conf << 'NGINX_CONF'
upstream php {
    server 127.0.0.1:9000;
}

server {
    listen 8080 default_server;
    listen [::]:8080 default_server;
    
    server_name _;
    root /app/public;
    index index.html;
    
    # Logging to container stdout/stderr
    access_log /proc/self/fd/1 combined;
    error_log /proc/self/fd/2 warn;
    
    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Asset cache (JS, CSS, fonts, images)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # JSON files cache (1 hour)
    location ~ \.(json|webmanifest)$ {
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }

    # HTML and index cache policy
    location ~ \.html?$ {
        expires -1;
        add_header Cache-Control "no-store, must-revalidate";
    }

    # PHP API endpoints
    location /api/ {
        try_files $uri =404;
        fastcgi_pass php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 300s;
        fastcgi_buffer_size 32k;
        fastcgi_buffers 8 32k;
    }

    # SPA routing - all unmapped URLs go to index.html
    location / {
        try_files $uri /index.html;
        expires -1;
        add_header Cache-Control "no-store, must-revalidate";
    }

    # Block access to hidden files/directories
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ ~$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
NGINX_CONF

# Supervisor configuration (manage PHP-FPM + Nginx)
# logfile must be a real file path (not /proc/self/fd/2) - supervisord tries to rotate it
RUN cat > /etc/supervisord.conf << 'SUPERVISOR_CONF'
[supervisord]
nodaemon=true
user=root
logfile=/dev/null
logfile_maxbytes=0
pidfile=/var/run/supervisord.pid
loglevel=info

[program:php-fpm]
command=php-fpm --nodaemonize
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
startsecs=0
priority=999

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
startsecs=0
priority=1000
SUPERVISOR_CONF

# Healthcheck script
RUN cat > /healthcheck.sh << 'HEALTHCHECK_SCRIPT'
#!/bin/sh
set -e

# Check if infos.json is accessible
if ! curl -sf http://localhost:8080/infos.json >/dev/null 2>&1; then
    echo "FAIL: infos.json not accessible"
    exit 1
fi

# Check if frontend loads
if ! curl -sf http://localhost:8080/ >/dev/null 2>&1; then
    echo "FAIL: Frontend not responding"
    exit 1
fi

# Check PHP-FPM responsiveness
if ! curl -fsS http://localhost:8080/api/health.php | grep -q '"status":"ok"'; then
    echo "FAIL: API health endpoint failed"
    exit 1
fi

echo "PASS: Health check successful"
exit 0
HEALTHCHECK_SCRIPT

RUN chmod +x /healthcheck.sh

# Port and healthcheck
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
    CMD /healthcheck.sh

# Run supervisor to manage PHP-FPM and Nginx
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
