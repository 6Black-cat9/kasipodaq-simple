<?php
declare(strict_types=1);

function fileView(array $file): array
{
    return [
        "id" => $file["id"],
        "fileUrl" => "api.php?path=files/" . $file["id"],
        "fileName" => $file["original_name"],
        "fileType" => $file["mime"],
        "fileSize" => (int) $file["size"],
    ];
}
function uploadedFile(array $user, bool $imagesOnly = false): array
{
    global $config, $storagePath;
    $file = $_FILES["file"] ?? null;
    if (
        !$file ||
        !isset($file["error"]) ||
        is_array($file["error"]) ||
        $file["error"] !== UPLOAD_ERR_OK
    ) {
        throw new ApiError(400, "Файлды таңдаңыз (ең көбі 10 МБ)");
    }
    if ($file["size"] <= 0 || $file["size"] > $config["max_upload_bytes"]) {
        throw new ApiError(400, "Файл көлемі 10 МБ-тан аспасын");
    }
    $extension = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));
    $formats = [
        "pdf" => ["application/pdf"],
        "jpg" => ["image/jpeg"],
        "jpeg" => ["image/jpeg"],
        "png" => ["image/png"],
        "doc" => ["application/msword", "application/x-ole-storage", "application/CDFV2"],
        "xls" => ["application/vnd.ms-excel", "application/x-ole-storage", "application/CDFV2"],
        "docx" => [
            "application/zip",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        "xlsx" => [
            "application/zip",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
    ];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file["tmp_name"]);
    if (
        !isset($formats[$extension]) ||
        !in_array($mime, $formats[$extension], true) ||
        ($imagesOnly && !in_array($extension, ["jpg", "jpeg", "png"], true))
    ) {
        throw new ApiError(400, "PDF, DOC, DOCX, XLS, XLSX, JPG немесе PNG файлын таңдаңыз");
    }
    $buffer = file_get_contents($file["tmp_name"]);
    $valid = match ($extension) {
        "pdf" => str_starts_with($buffer, "%PDF-") && str_contains(substr($buffer, -4096), "%%EOF"),
        "jpg", "jpeg", "png" => @getimagesize($file["tmp_name"]) !== false,
        "doc", "xls" => str_starts_with($buffer, "\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1") &&
            (str_contains(
                $buffer,
                $extension === "doc"
                    ? "W\0o\0r\0d\0D\0o\0c\0u\0m\0e\0n\0t\0"
                    : "W\0o\0r\0k\0b\0o\0o\0k\0",
            ) ||
                ($extension === "xls" && str_contains($buffer, "B\0o\0o\0k\0"))),
        "docx", "xlsx" => str_starts_with($buffer, "PK\x03\x04") &&
            str_contains($buffer, "[Content_Types].xml") &&
            str_contains(
                $buffer,
                $extension === "docx" ? "word/document.xml" : "xl/workbook.xml",
            ) &&
            !str_contains($buffer, "vbaProject.bin"),
        default => false,
    };
    unset($buffer);
    if (!$valid) {
        throw new ApiError(400, "Файлдың мазмұны көрсетілген пішімге сәйкес келмейді");
    }
    $name = uid() . "." . $extension;
    if (!move_uploaded_file($file["tmp_name"], "$storagePath/uploads/$name")) {
        throw new ApiError(500, "Файлды сақтау мүмкін болмады");
    }
    chmod("$storagePath/uploads/$name", 0600);
    $GLOBALS["newFiles"][] = "$storagePath/uploads/$name";
    $canonical = [
        "doc" => "application/msword",
        "xls" => "application/vnd.ms-excel",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    $record = [
        "id" => uid(),
        "original_name" => preg_replace('/[\x00-\x1f\x7f]/', "", basename($file["name"])),
        "stored_name" => $name,
        "mime" => $canonical[$extension] ?? $mime,
        "size" => (int) $file["size"],
        "owner_id" => $user["id"],
        "created_at" => now(),
    ];
    writeRow("files", $record);
    return $record;
}
function imageReference(mixed $image, array $user): ?string
{
    if (!$image) {
        return null;
    }
    if (!is_string($image)) {
        throw new ApiError(400, "Сурет мәні дұрыс емес");
    }
    if (
        preg_match('~^assets/images/[a-zA-Z0-9_-]+\.(jpg|jpeg|png)$~', $image) &&
        is_file(dirname(__DIR__) . "/public/" . $image)
    ) {
        return $image;
    }
    if (!preg_match('~^api\.php\?path=files/([a-f0-9]{24})$~', $image, $match)) {
        throw new ApiError(400, "Жүктелген суретті таңдаңыз");
    }
    $file = required("files", $match[1]);
    if (
        ($file["owner_id"] !== $user["id"] &&
            !in_array($user["role"], ["ADMIN", "CHAIRMAN"], true) &&
            !one("SELECT id FROM members WHERE user_id=? AND avatar=?", [$user["id"], $image])) ||
        !str_starts_with($file["mime"], "image/")
    ) {
        throw new ApiError(403, "Сурет сізге тиесілі емес");
    }
    return $image;
}
function downloadFile(string $id): never
{
    global $storagePath;
    $file = required("files", $id);
    $url = fileView($file)["fileUrl"];
    $public =
        countSql("SELECT COUNT(*) FROM documents WHERE file_id=?", [$id]) > 0 ||
        countSql(
            "SELECT COUNT(*) FROM news WHERE image=? AND status='PUBLISHED' AND published_at<=?",
            [$url, now()],
        ) > 0 ||
        countSql("SELECT COUNT(*) FROM events WHERE image=?", [$url]) > 0;
    if (!$public) {
        $user = requireUser();
        if (
            !in_array($user["role"], ["ADMIN", "CHAIRMAN"], true) &&
            $file["owner_id"] !== $user["id"]
        ) {
            $owned = countSql(
                "SELECT COUNT(*) FROM attachments a JOIN applications x ON x.id=a.application_id JOIN members m ON m.id=x.member_id WHERE a.file_id=? AND m.user_id=?",
                [$id, $user["id"]],
            );
            if (
                !$owned &&
                !one("SELECT id FROM members WHERE user_id=? AND avatar=?", [$user["id"], $url])
            ) {
                throw new ApiError(403, "Файлды көруге рұқсатыңыз жоқ");
            }
        }
    }
    $path = "$storagePath/uploads/" . $file["stored_name"];
    if (!is_file($path)) {
        throw new ApiError(404, "Файл табылмады");
    }
    $inline =
        in_array($file["mime"], ["application/pdf", "image/jpeg", "image/png"], true) &&
        ($_GET["download"] ?? "") !== "1";
    header("Content-Type: " . $file["mime"]);
    header(
        "Content-Disposition: " .
            ($inline ? "inline" : "attachment") .
            "; filename*=UTF-8''" .
            rawurlencode($file["original_name"]),
    );
    header("Content-Security-Policy: sandbox; default-src 'none'");
    header("Cache-Control: private, no-store");
    header("Content-Length: " . filesize($path));
    session_write_close();
    readfile($path);
    exit();
}
