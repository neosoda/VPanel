# Vpanel - Déploiement Coolify (référence opérationnelle)

## 1) Type d'application Coolify

Utiliser une application Docker basée sur le `Dockerfile` du dépôt (ou `docker-compose.prod.yml` si vous déployez en mode compose).

- Port interne: `8080`
- Healthcheck: `GET /api/health.php`
- Volume persistant requis: `/app/public/data`

## 2) Variables Build (obligatoires)

Définir dans les **Build Arguments**:

```env
VITE_APP_MODE=production
VITE_APP_BASE=/
VITE_APP_URL=https://vpanel.example.com/
VITE_APP_API_URL=/api/
VITE_USE_AUTH=false
```

Si vous utilisez `docker-compose.prod.yml` en mode Compose Coolify, renseigner
les mêmes valeurs avec le préfixe `COOLIFY_` (`COOLIFY_VITE_APP_URL`, etc.).

## 3) Variables Runtime (obligatoires)

Définir dans les **Environment Variables**:

```env
PHP_APP_MODE=production
PHP_DEBUG=false
APP_HOSTNAME=vpanel.example.com
SQLITE_DB_PATH=/app/public/data/vpanel.sqlite
```

Variables recommandées pour PHP-FPM:

```env
PHP_FPM_PM_MAX_CHILDREN=20
PHP_FPM_PM_START_SERVERS=4
PHP_FPM_PM_MIN_SPARE_SERVERS=2
PHP_FPM_PM_MAX_SPARE_SERVERS=10
```

## 4) Validation post-déploiement

Exécuter ces checks (depuis votre poste):

```bash
curl -fsS https://vpanel.example.com/infos.json
curl -fsS https://vpanel.example.com/api/health.php
curl -fsS https://vpanel.example.com/api/toPdf.php?require=1
```

Critères:

- `/api/health.php` doit retourner `"status":"ok"`.
- `/api/toPdf.php?require=1` doit répondre en JSON.

## 5) Persistance

Le backend écrit en SQLite sous `/app/public/data/vpanel.sqlite`.  
Sans volume sur `/app/public/data`, les stats seront perdues à chaque redéploiement/recréation de conteneur.
