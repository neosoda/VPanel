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

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$_phpMode = getenv('PHP_APP_MODE');
$_phpMode = ($_phpMode !== false && $_phpMode !== '') ? strtolower(trim($_phpMode)) : 'development';
$_phpDebug = getenv('PHP_DEBUG');
if ($_phpDebug !== false && $_phpDebug !== '') {
    $_displayErrors = in_array(strtolower(trim((string) $_phpDebug)), ['1', 'true', 'yes', 'on'], true);
} else {
    $_displayErrors = $_phpMode === 'development';
}
ini_set('display_errors', $_displayErrors ? '1' : '0');
ini_set('display_startup_errors', $_displayErrors ? '1' : '0');
error_reporting(E_ALL);
unset($_phpMode, $_phpDebug, $_displayErrors);

require __DIR__ . '/PHPMailer-master/src/Exception.php';
require __DIR__ . '/PHPMailer-master/src/PHPMailer.php';
require __DIR__ . '/PHPMailer-master/src/SMTP.php';

define('MYIP_NORETURN', true);
require_once __DIR__ . '/../myip.php';

function dd_json(mixed $content): void
{
    /*write_json([
        'errors' => $content,
        'status' => 'error',
        'message' => $content
    ]);*/
    write_json([
        'error' => $content
    ]);
}

function write_json(mixed $content): void
{
    header('Content-Type: application/json');
    echo json_encode($content);
    exit;
}

function exit_error(string $message, string $lib = 'main', string $code = 'system', array $params = []): void
{
    echo json_encode(array_merge(
        [
            'status' => 'error',
            'code' => $code,
            'lib' => $lib,
            'message' => $message,
        ],
        $params
    ));
    exit;
}

function exit_ok(string $lib = 'main', array $params = []): void
{
    echo json_encode(array_merge(
        [
            'status' => 'ok',
            'lib' => $lib,
        ],
        $params
    ));
    exit;
}

function send_Mail(array|string $to, string $subject, string $body): bool
{
    $mail = new PHPMailer(true);
    try {
        $mail->setLanguage('fr');
        $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'base64';
        $mail->isSMTP();
        $mail->isHTML(true);

        if (defined('SMTP_DEBUG'))
            $mail->SMTPDebug = SMTP_DEBUG;
        if (defined('SMTP_HOST'))
            $mail->Host = SMTP_HOST;
        if (defined('SMTP_AUTH'))
            $mail->SMTPAuth = SMTP_AUTH;
        if (defined('SMTP_USERNAME'))
            $mail->Username = SMTP_USERNAME;
        if (defined('SMTP_PASSWORD'))
            $mail->Password = SMTP_PASSWORD;
        if (defined('SMTP_SECURE'))
            $mail->SMTPSecure = SMTP_SECURE;
        if (defined('SMTP_PORT'))
            $mail->Port = SMTP_PORT;
        if (defined('SMTP_FROM')) {
            if (is_array(SMTP_FROM) && count(SMTP_FROM) === 2) {
                $mail->setFrom(SMTP_FROM[0], SMTP_FROM[1]);
                //$mail->addReplyTo(SMTP_FROM[0], SMTP_FROM[1]);
            } else if (is_string(SMTP_FROM)) {
                $mail->setFrom(SMTP_FROM);
                //$mail->addReplyTo(SMTP_FROM);
            }
        }
        if (is_array($to) && count($to) === 2) {
            $mail->addAddress($to[0], $to[1]);
        } else if (is_string($to)) {
            $mail->addAddress($to);
        }

        $mail->Subject = (defined('SMTP_SUBJECT_PREFIX') ? SMTP_SUBJECT_PREFIX : '') . $subject;
        $mail->Body = $body;
        $mail->AltBody = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        // $mail->ErrorInfo
        dd_json($mail->ErrorInfo);
        return false;
    }
}

function displayNameGenerator(): string
{
    $adjectifs = [
        'Joyeux',
        'Bavard',
        'Rapide',
        'Timide',
        'Rusé',
        'Majestueux',
        'Curieux',
        'Énergique',
        'Paisible',
        'Malicieux',
        'Brillant',
        'Audacieux',
        'Mystérieux',
        'Élégant',
        'Farfelu',
        'Fougueux',
        'Serein',
        'Intrépide',
        'Jovial',
        'Sage',
        'Vaillant',
        'Dynamique',
        'Charmant',
        'Noble',
        'Rigolo',
        'Zen',
        'Généreux',
        'Fabuleux',
        'Cosmique',
        'Magique',
        'Funky',
        'Disco',
        'Rebelle',
        'Féroce',
        'Doux',
        'Étincelant',
        'Flamboyant',
        'Glacial',
        'Torride',
        'Électrique',
        'Atomique',
        'Quantique',
        'Galactique',
        'Stellaire',
        'Lunaire',
        'Solaire',
        'Volcanique',
        'Océanique',
        'Montagnard',
        'Sauvage',
        'Urbain',
        'Rustique',
        'Futuriste',
        'Vintage',
        'Rétro',
        'Psychédélique',
        'Hypnotique',
        'Magnétique',
        'Spectaculaire',
        'Colossal',
        'Microscopique',
        'Infini',
        'Éternel',
        'Foudroyant',
        'Tourbillonnant',
        'Pétillant',
        'Scintillant',
        'Radieux',
        'Ténébreux',
        'Crépusculaire',
        'Chaotique',
        'Harmonieux',
        'Rythmique',
        'Mélodieux',
        'Symphonique',
        'Poétique',
        'Épique',
        'Légendaire',
        'Mythique',
        'Héroïque',
        'Diabolique',
        'Angélique',
        'Céleste',
        'Divin',
        'Sacré',
        'Profane',
        'Absurde',
        'Loufoque',
        'Déjanté',
        'Zinzin',
        'Givré',
        'Allumé',
        'Décalé',
        'Barré',
        'Timbré',
        'Dingo',
        'Cinglé',
        'Illuminé',
        'Visionnaire',
        'Transcendant',
        'Excentrique',
        'Baroque',
        'Rococo',
        'Gothique',
        'Punk',
        'Grunge',
        'Jazzy',
        'Bluesy',
        'Funky',
        'Techno',
        'Cybernétique',
        'Bionique',
        'Robotique',
        'Mécanique',
        'Organique',
        'Synthétique',
        'Naturel',
        'Sauvage',
        'Domestique',
        'Exotique'
    ];

    $noms = [
        'Panda',
        'Renard',
        'Licorne',
        'Dragon',
        'Koala',
        'Hibou',
        'Lama',
        'Pingouin',
        'Raton',
        'Castor',
        'Loutre',
        'Flamant',
        'Narval',
        'Poulpe',
        'Hérisson',
        'Axolotl',
        'Fennec',
        'Paresseux',
        'Capybara',
        'Quokka',
        'Phénix',
        'Lynx',
        'Mouffette',
        'Écureuil',
        'Colibri',
        'Marmotte',
        'Caméléon',
        'Morse',
        'Ornithorynque',
        'Tatou',
        'Toucan',
        'Perroquet',
        'Cacatoès',
        'Aigle',
        'Faucon',
        'Vautour',
        'Condor',
        'Albatros',
        'Pélican',
        'Cormoran',
        'Dauphin',
        'Orque',
        'Baleine',
        'Requin',
        'Raie',
        'Méduse',
        'Hippocampe',
        'Étoile',
        'Crabe',
        'Homard',
        'Crevette',
        'Langouste',
        'Seiche',
        'Calmar',
        'Pieuvre',
        'Tigre',
        'Léopard',
        'Jaguar',
        'Guépard',
        'Panthère',
        'Lion',
        'Lionne',
        'Lynx',
        'Puma',
        'Ocelot',
        'Ours',
        'Grizzli',
        'Panda',
        'Koala',
        'Wombat',
        'Kangourou',
        'Wallaby',
        'Émeu',
        'Kiwi',
        'Autruche',
        'Gazelle',
        'Antilope',
        'Impala',
        'Gnou',
        'Zèbre',
        'Girafe',
        'Éléphant',
        'Rhinocéros',
        'Hippopotame',
        'Buffle',
        'Bison',
        'Yak',
        'Chameau',
        'Dromadaire',
        'Lama',
        'Alpaga',
        'Vigogne',
        'Renne',
        'Caribou',
        'Élan',
        'Cerf',
        'Biche',
        'Chevreuil',
        'Sanglier',
        'Phacochère',
        'Mangouste',
        'Suricate',
        'Belette',
        'Hermine',
        'Fouine',
        'Blaireau',
        'Taupe',
        'Hérisson',
        'Musaraigne',
        'Chauve-souris',
        'Loup',
        'Coyote',
        'Chacal',
        'Hyène',
        'Renard',
        'Fennec',
        'Raton',
        'Tanuki',
        'Panda',
        'Binturong',
        'Lémurien',
        'Tarsier',
        'Ouistiti',
        'Tamarin',
        'Capucin',
        'Gorille',
        'Chimpanzé',
        'Orang-outan',
        'Gibbon',
        'Babouin',
        'Mandrill',
        'Macaque',
        'Singe',
        'Paresseux',
        'Tamanoir',
        'Fourmilier',
        'Pangolin',
        'Agouti',
        'Capybara',
        'Cochon',
        'Tapir',
        'Okapi',
        'Dugong',
        'Lamantin',
        'Phoque',
        'Otarie',
        'Morse',
        'Narval',
        'Béluga',
        'Cachalot'
    ];

    $adjectif = $adjectifs[array_rand($adjectifs)];
    $nom = $noms[array_rand($noms)];

    $nombre = rand(10, 99);

    return $adjectif . $nom . $nombre;
}

function dateDiff2Minutes(DateTime $startDate, DateTime $endDate): int
{
    $since = $startDate->diff($endDate);
    $minutes = $since->days * 24 * 60;
    $minutes += $since->h * 60;
    $minutes += $since->i;
    return $minutes;
}

function twoFaTokenGenerator($length = 6)
{
    $caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    $max = strlen($caracteres) - 1;

    for ($i = 0; $i < $length; $i++) {
        $code .= $caracteres[random_int(0, $max)];
    }

    return $code;
}

function stripeStatusText(string $status): string
{
    return match ($status) {
        'trialing' => "Période d'essai en cours",
        'active' => "Abonnement actif et en règle",
        'incomplete' => "Paiment echoué lors de la souscription",
        'incomplete_expired' => "Demande de paiement expirée",
        'past_due' => "Paiement echoué lors du renouvellement",
        'canceled' => "Abonnement annulé",
        'unpaid' => "Paiement echoué lors du renouvellement mais abonnement encore actif",
        'paused' => "Période d'essai terminée mais aucun paiement n'a été effectué"
    };
}

function filter_string_polyfill(string $string): string
{
    $str = preg_replace('/\\x00|<[^>]*>?/', '', $string);
    return trim(str_replace(["'", '"'], ["'", '"'], $str));
}


// mode
// PHP_APP_MODE env var allows Docker/Coolify to override the default (avoids
// endpoints that do not pass ?m= from falling back to 'development' in prod).
$_defaultMode = getenv('PHP_APP_MODE');
$_defaultMode = ($_defaultMode !== false && $_defaultMode !== '') ? $_defaultMode : 'development';
$_mode = isset($_GET['m']) ? trim(rawurldecode($_GET['m'])) : $_defaultMode;
$_mode = strtolower($_mode);
if (!preg_match('/^[a-z0-9_-]+$/', $_mode)) {
    $_mode = $_defaultMode;
}
define('MODE', $_mode);
unset($_defaultMode, $_mode);

$constantsFile = __DIR__ . '/constants.' . MODE . '.php';
if (is_file($constantsFile) && is_readable($constantsFile)) {
    include_once $constantsFile;
}
unset($constantsFile);

if (!defined('STATS_IGNORE_LOCALHOST')) {
    define('STATS_IGNORE_LOCALHOST', false);
}
if (!defined('STATS_VISITS_INTERVAL')) {
    define('STATS_VISITS_INTERVAL', '30 minutes');
}


// cors
$accessControlHeaders = trim((string) ($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ?? ''));
if ($accessControlHeaders === '') {
    $accessControlHeaders = 'Content-Type, Authorization, X-Requested-With';
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: {$accessControlHeaders}");
    header("Access-Control-Max-Age: 1728000");
    header("Content-Length: 0");
    header("Content-Type: text/plain");
    exit(0);
}
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");


// datetime
define('LOCALE', 'fr_FR.UTF-8');
setlocale(LC_ALL, LOCALE);
define('TIMEZONE', 'Europe/Paris');
date_default_timezone_set(TIMEZONE);
define('NOW', (new \DateTime('now', new \DateTimeZone('UTC'))));
define('NOW_TIMESTAMP', NOW->getTimestamp());


// referer
$rfr = isset($_GET['rfr']) ? stripslashes(trim(rawurldecode($_GET['rfr']))) : ($_SERVER['HTTP_REFERER'] ?? $_SERVER['HTTP_HOST'] ?? '');
define('REFERER', $rfr);
if (MODE !== 'development') {
    // ALLOWED_HOSTS can be defined in constants.<mode>.php to extend the list
    // with the site's own hostname (required for Coolify / self-hosted deployments).
    $defaultAllowedHosts = ['localhost', '127.0.0.1', 'www.vpanel.fr'];
    $runtimeHost = trim((string) (getenv('APP_HOSTNAME') ?: ''));
    if ($runtimeHost !== '') {
        $runtimeHost = preg_replace('#^https?://#i', '', $runtimeHost);
        $runtimeHost = explode('/', $runtimeHost)[0];
        $runtimeHost = trim($runtimeHost);
        if ($runtimeHost !== '') {
            $defaultAllowedHosts[] = $runtimeHost;
        }
    }
    $requestHost = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($requestHost !== '') {
        $defaultAllowedHosts[] = $requestHost;
    }
    $defaultAllowedHosts = array_values(array_unique($defaultAllowedHosts));
    $allowedHosts = defined('ALLOWED_HOSTS') ? array_merge($defaultAllowedHosts, ALLOWED_HOSTS) : $defaultAllowedHosts;
    $hostIsAllowed = in_array(true, array_map(fn($allowedHost) => stripos(REFERER, $allowedHost, 0) !== false, $allowedHosts));
    if (!$hostIsAllowed) {
        header("HTTP/1.1 401 Unauthorized");
        exit(0);
    }
}


// parent referer
$prt = trim(isset($_GET['prt']) ? stripslashes(trim(rawurldecode($_GET['prt']))) : '');
if (stripos(strtolower($prt), 'vpanel.fr') !== false)
    $prt = '';
define('PARENT_REFERER', $prt);


// client infos
$ip = isset($_GET['ip']) ? trim(rawurldecode($_GET['ip'])) : '';
if (!filter_var($ip, FILTER_VALIDATE_IP)) {
    $ip = getRealUserIp();
    if (strpos((string)$ip, ',') !== false) {
        $ips = explode(',', (string)$ip);
        $ip = trim($ips[0]);
    }
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        $ip = '0.0.0.0';
    }
}
define('CLIENT_IP', $ip);
define('CLIENT_TYPE', isBot() ? 'bot' : 'user');
define('CLIENT_FROM_LOCALHOST', CLIENT_IP === '127.0.0.1' || CLIENT_IP === '::1');


// user agent
$ua = trim(isset($_GET['ua']) ? trim(rawurldecode($_GET['ua'])) : (isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : ''));
define('USER_AGENT', $ua);


// database
try {
    if (!defined('SQLITE_DB_PATH')) {
        $envSqlitePath = trim((string) (getenv('SQLITE_DB_PATH') ?: ''));
        define('SQLITE_DB_PATH', $envSqlitePath !== '' ? $envSqlitePath : (__DIR__ . '/../../data/vpanel.sqlite'));
        unset($envSqlitePath);
    }
    $sqliteDir = dirname(SQLITE_DB_PATH);
    if (!is_dir($sqliteDir) && !mkdir($sqliteDir, 0775, true) && !is_dir($sqliteDir)) {
        throw new RuntimeException("Impossible de créer le dossier SQLite : {$sqliteDir}");
    }
    $pdo = new PDO("sqlite:" . SQLITE_DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA foreign_keys = ON;');
    define('DB', $pdo);
} catch (\Throwable $e) {
    dd_json(content: "Erreur SQLite : " . $e->getMessage());
    exit(0);
}
