<?php

/**
 * Vpanel - Health endpoint for container readiness/liveness.
 * Returns HTTP 200 when core checks pass, otherwise HTTP 503.
 */

declare(strict_types=1);

require_once __DIR__ . '/libs/config.php';

$checks = [];

// Database connectivity (SQLite)
try {
    DB->query('SELECT 1');
    $checks['sqlite'] = ['ok' => true];
} catch (\Throwable $e) {
    $checks['sqlite'] = ['ok' => false, 'error' => $e->getMessage()];
}

// Required runtime asset for PDF generation
$schemaFunctionsPath = __DIR__ . '/libs/toPdf/assets/schema_functions.json';
$checks['schema_functions_json'] = [
    'ok' => is_file($schemaFunctionsPath) && is_readable($schemaFunctionsPath),
    'path' => $schemaFunctionsPath,
];

// Runtime-writable directories
$sqliteDir = dirname(SQLITE_DB_PATH);
$iconCacheDir = __DIR__ . '/libs/toPdf/themes/icons';
if (!is_dir($iconCacheDir)) {
    @mkdir($iconCacheDir, 0775, true);
}
$checks['sqlite_directory_writable'] = ['ok' => is_dir($sqliteDir) && is_writable($sqliteDir), 'path' => $sqliteDir];
$checks['icon_cache_writable'] = ['ok' => is_dir($iconCacheDir) && is_writable($iconCacheDir), 'path' => $iconCacheDir];

$statusOk = array_reduce($checks, static function (bool $carry, array $item): bool {
    return $carry && (($item['ok'] ?? false) === true);
}, true);

http_response_code($statusOk ? 200 : 503);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'status' => $statusOk ? 'ok' : 'error',
    'mode' => MODE,
    'timestamp' => NOW->format('c'),
    'checks' => $checks,
], JSON_UNESCAPED_SLASHES);
