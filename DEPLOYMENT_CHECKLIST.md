# ⚠️ DOCUMENT HISTORIQUE (NON NORMATIF)

Cette checklist est conservée pour historique. La référence de déploiement est `COOLIFY_DEPLOYMENT.md`.

# Vpanel Coolify Deployment Checklist

## Pre-Deployment ✓

- [ ] All env vars defined (.env.coolify reviewed)
- [ ] `VITE_APP_HOSTNAME` set to actual domain
- [ ] `VITE_APP_URL` matches deployment URL
- [ ] `VITE_APP_API_URL` correct (with trailing slash)
- [ ] TLS certificate provisioned (if HTTPS required)
- [ ] Firewall rules allow port 8080 (or 80/443 if reverse proxy)

## Docker Build ✓

- [ ] `docker build` completes without errors
- [ ] Image size reasonable (~200-400MB)
- [ ] `docker history vpanel:latest` shows multi-stage build
- [ ] No `npm install` warnings or errors in build log
- [ ] No TypeScript compilation errors
- [ ] ESLint check passed (`npm run lint`)

## Container Startup ✓

- [ ] `docker run` succeeds
- [ ] Container doesn't crash/restart loop
- [ ] `docker logs` shows clean startup
- [ ] No PHP fatal errors in logs
- [ ] Nginx starts on port 8080
- [ ] Healthcheck passes within 30 seconds
- [ ] `docker ps` shows container running and healthy

## Network & Access ✓

- [ ] `curl http://localhost:8080/` returns 200 + HTML
- [ ] Root HTML contains `<div id="root"></div>`
- [ ] All assets (JS/CSS) load without 404s
- [ ] CORS headers correct if cross-origin API calls
- [ ] Reverse proxy (if used) forwards headers correctly
- [ ] HTTPS redirect works (if configured)

## Frontend Functionality ✓

- [ ] React app loads (no console JS errors)
- [ ] Main UI renders (modules, editor visible)
- [ ] Version info displays in footer
- [ ] Theme selector functional
- [ ] No `Uncaught Error` in browser console
- [ ] No network errors (check Network tab)
- [ ] LocalStorage accessible (projects can be created)

## API Endpoints ✓

- [ ] `GET /infos.json` returns version JSON
- [ ] `GET /api/choices.php` returns schema definitions
- [ ] `GET /api/resume.php` returns stats (may be empty)
- [ ] `POST /api/action.php` accepts project data
- [ ] PDF generation endpoint accessible (`/api/toPdf.php`)
- [ ] 404 errors return proper error (not HTML fallback)
- [ ] 5xx errors logged to PHP error_log

## Data & Persistence ✓

- [ ] `/projects` volume mounts successfully
- [ ] Create new project → localStorage persists
- [ ] Container restart → projects still accessible
- [ ] Export project as Base64 works
- [ ] Import Base64 project works
- [ ] File permissions allow read/write (www-data)

## Performance & Logging ✓

- [ ] Container startup time < 30s
- [ ] Page load time reasonable (< 3s typical)
- [ ] No memory leaks (check after 1 hour uptime)
- [ ] Logs are clean (no spam errors)
- [ ] Log rotation configured (json-file options)
- [ ] CPU usage stable (~5-10% idle)

## Error Handling ✓

- [ ] Missing env vars → sensible defaults
- [ ] Invalid PDF input → error returned (not crash)
- [ ] Oversized upload (>50MB) → rejected cleanly
- [ ] Network timeout → user-friendly message
- [ ] Browser back/forward → SPA routing works
- [ ] Page refresh → app state preserved (localStorage)

## Security ✓

- [ ] No credentials in Dockerfile or compose file
- [ ] Environment secrets passed at runtime only
- [ ] PHP `expose_php` disabled
- [ ] Display errors OFF in production
- [ ] Sensible file permissions (755/775)
- [ ] No world-writable volumes
- [ ] HTTPS termination via reverse proxy

## Post-Deployment Validation ✓

- [ ] Production URL is accessible
- [ ] SSL certificate valid (if HTTPS)
- [ ] Reverse proxy health checks pass
- [ ] No 502/503 errors (container responsive)
- [ ] PDF export works end-to-end
- [ ] Manual functional test (create project → edit → export)
- [ ] Monitor logs for 24 hours (no new errors)

## Rollback Plan ✓

- [ ] Previous version tagged and accessible
- [ ] Rollback procedure documented
- [ ] DNS/proxy can quickly revert to old version
- [ ] Data migration plan (if any schema changes)
- [ ] Communication plan if deployment fails

---

## Test Results

### Date: _________________
### Deployed By: _________________
### Environment: _________________

### Build Status: [ ] PASS [ ] FAIL
Build time: _________ seconds
Image size: _________ MB
Errors: _________

### Container Status: [ ] PASS [ ] FAIL
Startup time: _________ seconds
Healthcheck: [ ] PASS [ ] FAIL
Memory usage: _________ MB
CPU usage: _________ %

### Functional Tests: [ ] PASS [ ] FAIL
Frontend loads: [ ] Yes [ ] No
API responsive: [ ] Yes [ ] No
Projects persist: [ ] Yes [ ] No
PDF export works: [ ] Yes [ ] No

### Issues Found:
- 
- 
- 

### Sign-off:
_______________________ (Date/Time)
