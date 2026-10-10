<?php
// NBK EXPRESS — DEV-ONLY webhook inbox for the static mockup. NOT a production endpoint.
//   POST ?k=SECRET            BCL webhook → stored in data/inbox.jsonl (expose with `ngrok http 80` for BCL to reach it)
//   GET  ?action=info         local URL incl. secret (localhost only)
//   GET  ?action=list&after=N stored events after seq N (localhost only; the mockup polls this)
//   GET  ?action=pull&token=  copy BCL POSTs from a webhook.site token into the inbox (localhost only; browser can't — no CORS)
declare(strict_types=1);
date_default_timezone_set('Asia/Kuala_Lumpur');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dir = __DIR__ . '/data';
if (!is_dir($dir)) mkdir($dir, 0775, true);
if (!file_exists("$dir/.htaccess")) file_put_contents("$dir/.htaccess", "Require all denied\n");
$secretFile = "$dir/secret.txt";
if (!file_exists($secretFile)) file_put_contents($secretFile, bin2hex(random_bytes(16)));
$secret = trim((string) file_get_contents($secretFile));
$inbox = "$dir/inbox.jsonl";
const MAX_BYTES = 100 * 1024;

function out(int $code, array $body): never
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function append(string $file, array $row): void
{
    $fh = fopen($file, 'ab');
    flock($fh, LOCK_EX);
    fwrite($fh, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
    flock($fh, LOCK_UN);
    fclose($fh);
}
function rows(string $file): array
{
    if (!file_exists($file)) return [];
    $out = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES) as $i => $line) {
        $r = json_decode($line, true);
        if (is_array($r)) { $r['seq'] = $i + 1; $out[] = $r; }
    }
    return $out;
}

// ---- BCL (or ngrok) delivering a webhook ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($secret, (string) ($_GET['k'] ?? ''))) out(403, ['error' => 'forbidden']);
    $raw = (string) file_get_contents('php://input', false, null, 0, MAX_BYTES + 1);
    if (strlen($raw) > MAX_BYTES) out(413, ['error' => 'payload too large']);
    $json = json_decode($raw, true);
    if (!is_array($json)) out(400, ['error' => 'invalid json']);
    append($inbox, ['received_at' => date('c'), 'via' => 'post', 'payload' => $json]);
    out(200, ['received' => true]); // acknowledge fast; the mockup validates/imports
}

// ---- everything below is for the mockup on this machine only ----
$addr = $_SERVER['REMOTE_ADDR'] ?? '';
$isLocal = in_array($addr, ['127.0.0.1', '::1'], true) && empty($_SERVER['HTTP_X_FORWARDED_FOR']);
if (!$isLocal) out(403, ['error' => 'local only']);

$action = $_GET['action'] ?? 'list';
if ($action === 'info') {
    $path = str_replace(' ', '%20', $_SERVER['SCRIPT_NAME']);
    out(200, ['local_url' => 'http://' . $_SERVER['HTTP_HOST'] . $path . '?k=' . $secret, 'path' => $path . '?k=' . $secret, 'count' => count(rows($inbox))]);
}
if ($action === 'list') {
    $after = (int) ($_GET['after'] ?? 0);
    $all = rows($inbox);
    out(200, ['events' => array_values(array_filter($all, fn ($r) => $r['seq'] > $after)), 'last' => count($all)]);
}
if ($action === 'pull') {
    $token = (string) ($_GET['token'] ?? '');
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $token)) out(400, ['error' => 'token webhook.site tidak sah']);
    $ch = curl_init("https://webhook.site/token/$token/requests?sorting=oldest&per_page=100");
    $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['Accept: application/json']];
    $ca = 'C:/xampp/apache/bin/curl-ca-bundle.crt'; // XAMPP ships this; php.ini often has no curl.cainfo
    if (is_file($ca)) $opts[CURLOPT_CAINFO] = $ca;
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false || $status !== 200) out(502, ['error' => 'gagal capai webhook.site: ' . ($err ?: "HTTP $status")]);
    $seen = array_column(rows($inbox), 'source_id');
    $added = 0; $skipped = 0;
    foreach ((json_decode($body, true)['data'] ?? []) as $r) {
        $json = json_decode((string) ($r['content'] ?? ''), true);
        if (($r['method'] ?? '') !== 'POST' || !is_array($json)) { $skipped++; continue; }
        if (in_array($r['uuid'], $seen, true)) continue;
        append($inbox, ['received_at' => $r['created_at'] ?? date('c'), 'via' => 'webhook.site', 'source_id' => $r['uuid'], 'payload' => $json]);
        $added++;
    }
    out(200, ['added' => $added, 'skipped_non_json' => $skipped]);
}
out(400, ['error' => 'unknown action']);
