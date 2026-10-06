<?php
if (parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH) === "/") {
    return false;
}
$path = rawurldecode(parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH) ?: "/");
if (str_starts_with($path, "/api/")) {
    $_GET["path"] = substr($path, 5);
    require __DIR__ . "/api.php";
    return true;
}
$file = realpath(__DIR__ . $path);
if (
    $file &&
    str_starts_with($file, __DIR__ . DIRECTORY_SEPARATOR) &&
    is_file($file) &&
    !str_starts_with(basename($file), ".")
) {
    return false;
}
http_response_code(404);
header("Content-Type: text/plain; charset=utf-8");
echo "Бет табылмады";
