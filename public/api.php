<?php
declare(strict_types=1);
header("Content-Type: application/json; charset=utf-8");
header("X-Content-Type-Options: nosniff");
header("Cache-Control: no-store");
header("Referrer-Policy: same-origin");
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'self'");
$transaction = false;
$newFiles = [];
try {
    require dirname(__DIR__) . "/app/bootstrap.php";
    require dirname(__DIR__) . "/app/files.php";
    require dirname(__DIR__) . "/app/modules.php";
    $method = $_SERVER["REQUEST_METHOD"];
    $path = (string) ($_GET["path"] ?? "meta");
    limitRequests(
        $path === "auth/login" ? "login" : "api",
        $path === "auth/login" ? 20 : 600,
        $path === "auth/login" ? 900 : 60,
    );
    $b = [];
    if (in_array($method, ["POST", "PUT", "DELETE", "PATCH"], true)) {
        if (
            !hash_equals($_SESSION["csrf"], $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "")
        ) {
            throw new ApiError(
                403,
                "Қауіпсіздік токені қате. Бетті жаңартыңыз",
            );
        }
        if (isset($_SERVER["HTTP_ORIGIN"])) {
            $origin = parse_url($_SERVER["HTTP_ORIGIN"]);
            $expected =
                (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off"
                    ? "https"
                    : "http") .
                "://" .
                $_SERVER["HTTP_HOST"];
            if (rtrim($_SERVER["HTTP_ORIGIN"], "/") !== $expected) {
                throw new ApiError(403, "Сұрау көзіне рұқсат жоқ");
            }
        }
        if (
            str_starts_with($_SERVER["CONTENT_TYPE"] ?? "", "application/json")
        ) {
            if ((int) ($_SERVER["CONTENT_LENGTH"] ?? 0) > 1024 * 1024) {
                throw new ApiError(413, "Сұрау тым үлкен");
            }
            $raw = file_get_contents("php://input");
            $b = json_decode($raw ?: "{}", true, 64, JSON_THROW_ON_ERROR);
            if (!is_array($b) || (array_is_list($b) && $b !== [])) {
                throw new ApiError(400, "JSON объектісі қажет");
            }
        } else {
            $b = $_POST;
        }
        db()->exec("BEGIN IMMEDIATE");
        $transaction = true;
    }
    [$data, $message, $status] = dispatch($path, $method, $b);
    if ($transaction) {
        db()->exec("COMMIT");
        $transaction = false;
    }
    http_response_code($status);
    echo json_encode(
        ["success" => true, "message" => $message, "data" => $data],
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
    );
} catch (Throwable $e) {
    if ($transaction) {
        db()->exec("ROLLBACK");
    }
    foreach ($newFiles as $f) {
        if (is_file($f)) {
            unlink($f);
        }
    }
    $status =
        $e instanceof ApiError
            ? $e->status
            : ($e instanceof JsonException
                ? 400
                : ($e instanceof PDOException &&
                str_contains($e->getMessage(), "constraint")
                    ? 409
                    : 500));
    $message =
        $e instanceof ApiError
            ? $e->getMessage()
            : ($status === 400
                ? "JSON дұрыс емес"
                : ($status === 409
                    ? "Жазба бұрыннан бар немесе басқа жазбалармен байланысты"
                    : "Сервер қатесі. Қайта көріңіз"));
    if ($status === 500) {
        error_log("KASIPODAQ: " . $e->getMessage());
    }
    http_response_code($status);
    echo json_encode(
        [
            "success" => false,
            "message" => $message,
            "errors" => $e instanceof ApiError ? $e->errors : [],
        ],
        JSON_UNESCAPED_UNICODE,
    );
}
