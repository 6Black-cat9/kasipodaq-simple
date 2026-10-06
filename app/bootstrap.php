<?php
declare(strict_types=1);

final class ApiError extends RuntimeException
{
    public function __construct(public int $status, string $message, public array $errors = [])
    {
        parent::__construct($message);
    }
}
$configFile = dirname(__DIR__) . "/config.php";
$config = is_file($configFile)
    ? require $configFile
    : require dirname(__DIR__) . "/config.example.php";
$storagePath = getenv("KASIPODAQ_STORAGE") ?: $config["storage"];
foreach ([$storagePath, "$storagePath/uploads", "$storagePath/sessions"] as $directory) {
    if (!is_dir($directory) && !mkdir($directory, 0700, true)) {
        throw new RuntimeException("Storage unavailable");
    }
}
date_default_timezone_set("UTC");
ini_set("display_errors", "0");
ini_set("session.use_strict_mode", "1");
ini_set("session.gc_maxlifetime", (string) ($config["session_hours"] * 3600));
session_save_path("$storagePath/sessions");
session_name("kasipodaq_session");
session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => !empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off",
    "httponly" => true,
    "samesite" => "Lax",
]);
session_start();
$_SESSION["csrf"] ??= bin2hex(random_bytes(32));

function db(): PDO
{
    static $connection;
    global $storagePath;
    if ($connection) {
        return $connection;
    }
    $connection = new PDO("sqlite:" . $storagePath . "/kasipodaq.sqlite", null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $connection->exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
    if (
        !$connection
            ->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            ->fetch()
    ) {
        $connection->exec("BEGIN IMMEDIATE");
        try {
            $connection->exec(file_get_contents(__DIR__ . "/schema.sql"));
            $connection->exec("COMMIT");
        } catch (Throwable $e) {
            $connection->exec("ROLLBACK");
            throw $e;
        }
    }
    $connection->sqliteCreateFunction("kk_lower", fn($text) => lower((string) $text), 1);
    return $connection;
}
function lower(string $value): string
{
    return function_exists("mb_strtolower")
        ? mb_strtolower($value, "UTF-8")
        : strtr(
            strtolower($value),
            array_combine(
                preg_split(
                    "//u",
                    "АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЩЪЫІЬЭЮЯ",
                    -1,
                    PREG_SPLIT_NO_EMPTY,
                ),
                preg_split(
                    "//u",
                    "аәбвгғдеёжзийкқлмнңоөпрстуұүфхһцчшщъыіьэюя",
                    -1,
                    PREG_SPLIT_NO_EMPTY,
                ),
            ),
        );
}
function run(string $sql, array $parameters = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($parameters);
    return $statement;
}
function rows(string $sql, array $parameters = []): array
{
    return run($sql, $parameters)->fetchAll();
}
function one(string $sql, array $parameters = []): ?array
{
    return run($sql, $parameters)->fetch() ?: null;
}
function countSql(string $sql, array $parameters = []): int
{
    return (int) run($sql, $parameters)->fetchColumn();
}
function uid(): string
{
    return bin2hex(random_bytes(12));
}
function now(): string
{
    return gmdate("Y-m-d\TH:i:s\Z");
}
function writeRow(string $table, array $data): void
{
    if (!preg_match('/^[a-z_]+$/', $table)) {
        throw new LogicException("Invalid table");
    }
    foreach (array_keys($data) as $key) {
        if (!preg_match('/^[a-z_]+$/', $key)) {
            throw new LogicException("Invalid field");
        }
    }
    run(
        "INSERT INTO " .
            $table .
            " (" .
            implode(",", array_keys($data)) .
            ") VALUES (" .
            implode(",", array_fill(0, count($data), "?")) .
            ")",
        array_values($data),
    );
}
function updateRow(string $table, string $id, array $data): void
{
    if (!$data) {
        return;
    }
    if (!preg_match('/^[a-z_]+$/', $table)) {
        throw new LogicException("Invalid table");
    }
    foreach (array_keys($data) as $key) {
        if (!preg_match('/^[a-z_]+$/', $key)) {
            throw new LogicException("Invalid field");
        }
    }
    run(
        "UPDATE " .
            $table .
            " SET " .
            implode(",", array_map(fn($key) => "$key=?", array_keys($data))) .
            " WHERE id=?",
        [...array_values($data), $id],
    );
}
function ok(mixed $data = null, string $message = "Сәтті орындалды", int $status = 200): array
{
    return [$data, $message, $status];
}
function keys(array $input, array $allowed): void
{
    foreach (array_keys($input) as $key) {
        if (!in_array($key, $allowed, true)) {
            throw new ApiError(400, "Белгісіз өріс: " . $key);
        }
    }
}
function text(array $input, string $key, int $min = 1, int $max = 200): string
{
    $value = $input[$key] ?? "";
    if (!is_string($value) && !is_numeric($value)) {
        throw new ApiError(400, "Өріс дұрыс емес", [
            ["field" => $key, "message" => "Мәтін енгізіңіз"],
        ]);
    }
    $value = trim((string) $value);
    $length = preg_match_all("/./us", $value);
    if ($length === false || $length < $min || $length > $max) {
        throw new ApiError(400, "Өрістерді тексеріңіз", [
            ["field" => $key, "message" => "$min–$max таңба енгізіңіз"],
        ]);
    }
    return $value;
}
function choice(array $input, string $key, array $values, ?string $default = null): string
{
    $value = $input[$key] ?? $default;
    if (!is_string($value) || !in_array($value, $values, true)) {
        throw new ApiError(400, "Өріс мәні дұрыс емес", [
            ["field" => $key, "message" => "Тізімнен таңдаңыз"],
        ]);
    }
    return $value;
}
function boolValue(mixed $value): bool
{
    if (!in_array($value, [true, false, 0, 1, "0", "1", "true", "false"], true)) {
        throw new ApiError(400, "Логикалық мән дұрыс емес");
    }
    return in_array($value, [true, 1, "1", "true"], true);
}
function emailValue(array $input): string
{
    $value = lower(text($input, "email", 3, 254));
    if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
        throw new ApiError(400, "Email мекенжайы дұрыс емес");
    }
    return $value;
}
function passwordValue(array $input, string $key = "password"): string
{
    $value = $input[$key] ?? "";
    if (!is_string($value) || strlen($value) < 8 || strlen($value) > 72) {
        throw new ApiError(400, "Құпиясөз 8–72 байт болсын");
    }
    return $value;
}
function dateValue(string $value): string
{
    $date = DateTimeImmutable::createFromFormat("!Y-m-d", substr($value, 0, 10));
    if (!$date || $date->format("Y-m-d") !== substr($value, 0, 10)) {
        throw new ApiError(400, "Күнді дұрыс енгізіңіз");
    }
    return $date->format("Y-m-d");
}
function required(string $table, string $id): array
{
    $row = one("SELECT * FROM $table WHERE id=?", [$id]);
    if (!$row) {
        throw new ApiError(404, "Жазба табылмады");
    }
    return $row;
}
function pageArguments(): array
{
    $page = filter_var($_GET["page"] ?? 1, FILTER_VALIDATE_INT);
    $size = filter_var($_GET["pageSize"] ?? 10, FILTER_VALIDATE_INT);
    if (
        $page === false ||
        $page < 1 ||
        $page > 100000 ||
        $size === false ||
        $size < 1 ||
        $size > 100
    ) {
        throw new ApiError(400, "Бет параметрлері дұрыс емес");
    }
    $q = isset($_GET["q"]) ? text($_GET, "q", 0, 200) : "";
    return [$page, $size, ($page - 1) * $size, $q];
}
function listing(
    string $table,
    string $where,
    array $parameters,
    string $order,
    callable $view,
): array {
    [$page, $size, $offset] = pageArguments();
    return [
        "items" => array_map(
            $view,
            rows(
                "SELECT * FROM $table WHERE $where ORDER BY $order LIMIT $size OFFSET $offset",
                $parameters,
            ),
        ),
        "total" => countSql("SELECT COUNT(*) FROM $table WHERE $where", $parameters),
        "page" => $page,
        "pageSize" => $size,
    ];
}
function limitRequests(string $scope, int $limit, int $seconds): void
{
    $key = hash("sha256", $scope . ($_SERVER["REMOTE_ADDR"] ?? "local"));
    $time = time();
    run(
        "INSERT INTO rate_limits(key,start,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN start<? THEN 1 ELSE hits+1 END,start=CASE WHEN start<? THEN excluded.start ELSE start END",
        [$key, $time, $time - $seconds, $time - $seconds],
    );
    if (countSql("SELECT hits FROM rate_limits WHERE key=?", [$key]) > $limit) {
        throw new ApiError(429, "Сұрау тым көп. Біраздан кейін қайталаңыз");
    }
    if (random_int(1, 100) === 1) {
        run("DELETE FROM rate_limits WHERE start<?", [$time - 86400]);
    }
}
function userView(array $row): array
{
    $member = one("SELECT * FROM members WHERE user_id=?", [$row["id"]]);
    return [
        "id" => $row["id"],
        "email" => $row["email"],
        "role" => $row["role"],
        "isActive" => (bool) $row["is_active"],
        "createdAt" => $row["created_at"],
        "member" => $member ? memberView($member, false) : null,
    ];
}
function memberView(array $row, bool $withUser = true): array
{
    $view = [
        "id" => $row["id"],
        "userId" => $row["user_id"],
        "firstName" => $row["first_name"],
        "lastName" => $row["last_name"],
        "middleName" => $row["middle_name"],
        "phone" => $row["phone"],
        "position" => $row["position"],
        "department" => $row["department"],
        "joinDate" => $row["join_date"],
        "status" => $row["status"],
        "avatar" => $row["avatar"],
    ];
    if ($withUser) {
        $u = required("users", $row["user_id"]);
        $view["user"] = [
            "id" => $u["id"],
            "email" => $u["email"],
            "role" => $u["role"],
            "isActive" => (bool) $u["is_active"],
        ];
    }
    return $view;
}
function actorView(string $id): array
{
    $u = required("users", $id);
    $m = one("SELECT first_name,last_name FROM members WHERE user_id=?", [$id]);
    return [
        "id" => $id,
        "role" => $u["role"],
        "name" => $m ? $m["last_name"] . " " . $m["first_name"] : $u["email"],
    ];
}
function currentUser(): ?array
{
    global $config;
    if (!isset($_SESSION["user_id"])) {
        return null;
    }
    if (($_SESSION["expires"] ?? 0) < time()) {
        unset($_SESSION["user_id"]);
        return null;
    }
    $user = one("SELECT * FROM users WHERE id=?", [$_SESSION["user_id"]]);
    if (!$user || !$user["is_active"] || (int) $user["version"] !== ($_SESSION["version"] ?? -1)) {
        unset($_SESSION["user_id"]);
        return null;
    }
    return $user;
}
function requireUser(array $roles = []): array
{
    $u = currentUser();
    if (!$u) {
        throw new ApiError(401, "Жүйеге кіріңіз");
    }
    if ($roles && !in_array($u["role"], $roles, true)) {
        throw new ApiError(403, "Бұл әрекетке рұқсатыңыз жоқ");
    }
    return $u;
}
function staff(): bool
{
    $u = currentUser();
    return $u && in_array($u["role"], ["ADMIN", "CHAIRMAN"], true);
}
function notify(
    string $user,
    string $title,
    string $message,
    string $type,
    ?string $link = null,
): void {
    writeRow("notifications", [
        "id" => uid(),
        "user_id" => $user,
        "title" => $title,
        "message" => $message,
        "type" => $type,
        "link" => $link,
        "is_read" => 0,
        "created_at" => now(),
    ]);
}
function settings(): array
{
    $result = [];
    foreach (rows("SELECT * FROM settings") as $r) {
        $result[$r["key"]] = $r["value"];
    }
    return $result;
}
function protectAdmin(array $old, array $updates, bool $delete = false): void
{
    $me = requireUser(["ADMIN"]);
    $nextRole = $updates["role"] ?? $old["role"];
    $active = $updates["is_active"] ?? $old["is_active"];
    if ($old["id"] === $me["id"] && ($delete || $nextRole !== "ADMIN" || !$active)) {
        throw new ApiError(409, "Өз әкімші аккаунтыңызды өшіруге болмайды");
    }
    if (
        $old["role"] === "ADMIN" &&
        $old["is_active"] &&
        ($delete || $nextRole !== "ADMIN" || !$active) &&
        countSql("SELECT COUNT(*) FROM users WHERE role='ADMIN' AND is_active=1") <= 1
    ) {
        throw new ApiError(409, "Кемінде бір белсенді әкімші қалуы керек");
    }
}
