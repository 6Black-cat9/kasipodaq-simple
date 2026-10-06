<?php
declare(strict_types=1);
function camel(array $row): array
{
    $out = [];
    foreach ($row as $k => $v) {
        $out[preg_replace_callback("/_([a-z])/", fn($m) => strtoupper($m[1]), $k)] = $v;
    }
    return $out;
}
function appAccess(string $id): array
{
    $u = requireUser();
    $a = required("applications", $id);
    $m = required("members", $a["member_id"]);
    if (!staff() && $m["user_id"] !== $u["id"]) {
        throw new ApiError(403, "Бұл өтінішке рұқсатыңыз жоқ");
    }
    return $a;
}
function appView(array $a): array
{
    $v = camel($a);
    $v["amount"] = $a["amount_cents"] === null ? null : $a["amount_cents"] / 100;
    $v["member"] = memberView(required("members", $a["member_id"]), staff());
    return $v;
}
function contentView(string $table, array $r): array
{
    $v = camel($r);
    if ($table === "documents") {
        $v = array_merge($v, fileView(required("files", $r["file_id"])), [
            "id" => $r["id"],
        ]);
    }
    if ($table === "events") {
        if ($r["status"] === "UPCOMING" && $r["date"] < gmdate("Y-m-d")) {
            $v["status"] = "PAST";
        }
        $v["participants"] = countSql("SELECT COUNT(*) FROM participants WHERE event_id=?", [
            $r["id"],
        ]);
        $u = currentUser();
        $v["joined"] = $u
            ? (bool) one("SELECT 1 FROM participants WHERE event_id=? AND user_id=?", [
                $r["id"],
                $u["id"],
            ])
            : false;
    }
    return $v;
}
function memberData(array $b): array
{
    return [
        "first_name" => text($b, "firstName", 1, 80),
        "last_name" => text($b, "lastName", 1, 80),
        "middle_name" => text($b, "middleName", 0, 80),
        "avatar" => empty($b["avatar"])
            ? null
            : imageReference($b["avatar"], requireUser(["ADMIN"])),
        "phone" => text($b, "phone", 0, 30),
        "position" => text($b, "position", 1, 120),
        "department" => text($b, "department", 1, 120),
        "join_date" => dateValue(text($b, "joinDate", 10, 10)),
        "status" => choice($b, "status", ["ACTIVE", "INACTIVE"], "ACTIVE"),
    ];
}
function contentData(string $table, array $b, array $u): array
{
    $d = [
        "title" => text($b, "title", 3, 200),
        "description" => text($b, "description", 0, 20000),
    ];
    if ($table === "news") {
        $d = [
            "title" => $d["title"],
            "slug" => text($b, "slug", 3, 180),
            "short_description" => text($b, "shortDescription", 3, 600),
            "content" => text($b, "content", 3, 50000),
            "status" => choice($b, "status", ["DRAFT", "PUBLISHED"], "DRAFT"),
            "published_at" => null,
        ];
        if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $d["slug"])) {
            throw new ApiError(400, "Slug: латын әріптері, сан және дефис");
        }
        if ($d["status"] === "PUBLISHED") {
            $d["published_at"] = now();
        }
    }
    if ($table === "documents") {
        $d["category"] = choice($b, "category", [
            "RULES",
            "RESOLUTIONS",
            "MINUTES",
            "ORDERS",
            "REPORTS",
            "REGULATIONS",
            "OTHER",
        ]);
        $f = required("files", text($b, "fileId", 24, 24));
        if ($f["owner_id"] !== $u["id"] && $u["role"] !== "ADMIN") {
            throw new ApiError(403, "Файл сізге тиесілі емес");
        }
        $d["file_id"] = $f["id"];
    }
    if ($table === "events") {
        $d += [
            "date" => dateValue(text($b, "date", 10, 10)),
            "start_time" => text($b, "startTime", 5, 5),
            "end_time" => text($b, "endTime", 5, 5),
            "location" => text($b, "location", 2, 200),
            "organizer" => text($b, "organizer", 2, 150),
            "status" => choice($b, "status", ["UPCOMING", "PAST", "CANCELLED"], "UPCOMING"),
        ];
        foreach (["start_time", "end_time"] as $k) {
            if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $d[$k])) {
                throw new ApiError(400, "Уақыт дұрыс емес");
            }
        }
        if ($d["end_time"] <= $d["start_time"]) {
            throw new ApiError(400, "Аяқталу уақыты басталуынан кейін болсын");
        }
    }
    if ($table !== "documents") {
        $d["image"] = empty($b["image"]) ? null : imageReference($b["image"], $u);
    }
    return $d;
}
function dispatch(string $path, string $method, array $b): array
{
    global $config;
    $p = explode("/", trim($path, "/"));
    $resource = $p[0];
    $id = $p[1] ?? null;
    $action = $p[2] ?? null;
    $staffRoles = ["ADMIN", "CHAIRMAN"];
    if ($resource === "overview" && $method === "GET") {
        return ok([
            "members" => countSql("SELECT COUNT(*) FROM members WHERE status='ACTIVE'"),
            "applications" => countSql(
                "SELECT COUNT(*) FROM applications WHERE status IN ('NEW','IN_REVIEW','NEEDS_INFO')",
            ),
            "events" => countSql(
                "SELECT COUNT(*) FROM events WHERE status='UPCOMING' AND date>=?",
                [gmdate("Y-m-d")],
            ),
            "documents" => countSql("SELECT COUNT(*) FROM documents"),
        ]);
    }
    if ($resource === "meta" && $method === "GET") {
        return ok([
            "csrf" => $_SESSION["csrf"],
            "installed" => countSql("SELECT COUNT(*) FROM users") > 0,
            "settings" => settings(),
            "user" => ($u = currentUser()) ? userView($u) : null,
        ]);
    }
    if ($resource === "setup" && $method === "POST") {
        if (countSql("SELECT COUNT(*) FROM users")) {
            throw new ApiError(409, "Жүйе орнатылған");
        }
        require __DIR__ . "/seed.php";
        seed(
            emailValue($b),
            passwordValue($b),
            text($b, "firstName", 1, 80),
            text($b, "lastName", 1, 80),
            boolValue($b["demo"] ?? false),
        );
        return ok(null, "Жүйе орнатылды", 201);
    }
    if ($resource === "auth") {
        if ($id === "login" && $method === "POST") {
            $u = one("SELECT * FROM users WHERE email=?", [emailValue($b)]);
            if (
                !$u ||
                !password_verify((string) ($b["password"] ?? ""), $u["password"]) ||
                !$u["is_active"]
            ) {
                throw new ApiError(401, "Email немесе құпиясөз қате");
            }
            session_regenerate_id(true);
            $_SESSION["user_id"] = $u["id"];
            $_SESSION["version"] = (int) $u["version"];
            $_SESSION["expires"] = time() + $config["session_hours"] * 3600;
            $_SESSION["csrf"] = bin2hex(random_bytes(32));
            return ok(["user" => userView($u), "csrf" => $_SESSION["csrf"]]);
        }
        if ($id === "logout" && $method === "POST") {
            requireUser();
            $_SESSION = [];
            session_regenerate_id(true);
            $_SESSION["csrf"] = bin2hex(random_bytes(32));
            return ok(["csrf" => $_SESSION["csrf"]]);
        }
        $u = requireUser();
        if ($id === "me" && $method === "GET") {
            return ok(userView($u));
        }
        if ($id === "password" && $method === "PUT") {
            if (!password_verify((string) ($b["currentPassword"] ?? ""), $u["password"])) {
                throw new ApiError(400, "Қазіргі құпиясөз қате");
            }
            updateRow("users", $u["id"], [
                "password" => password_hash(passwordValue($b), PASSWORD_BCRYPT),
                "version" => (int) $u["version"] + 1,
                "updated_at" => now(),
            ]);
            $_SESSION["version"] = (int) $u["version"] + 1;
            return ok(null, "Құпиясөз өзгертілді");
        }
        if ($id === "profile" && $method === "PUT") {
            $m = one("SELECT * FROM members WHERE user_id=?", [$u["id"]]);
            if (!$m) {
                throw new ApiError(404, "Профиль табылмады");
            }
            $d = [
                "first_name" => text($b, "firstName", 1, 80),
                "last_name" => text($b, "lastName", 1, 80),
                "middle_name" => text($b, "middleName", 0, 80),
                "phone" => text($b, "phone", 0, 30),
                "avatar" => empty($b["avatar"]) ? null : imageReference($b["avatar"], $u),
                "updated_at" => now(),
            ];
            updateRow("members", $m["id"], $d);
            return ok(userView(required("users", $u["id"])));
        }
    }
    if ($resource === "uploads" && $method === "POST") {
        return ok(fileView(uploadedFile(requireUser())), "Файл жүктелді", 201);
    }
    if ($resource === "files" && $method === "GET" && $id) {
        downloadFile($id);
    }
    if ($resource === "members") {
        $u = requireUser($method === "GET" ? $staffRoles : ["ADMIN"]);
        if ($method === "GET" && $id === "options") {
            return ok([
                "departments" => array_column(
                    rows("SELECT DISTINCT department FROM members ORDER BY department"),
                    "department",
                ),
                "positions" => array_column(
                    rows("SELECT DISTINCT position FROM members ORDER BY position"),
                    "position",
                ),
            ]);
        }
        if ($method === "GET" && !$id) {
            [, , , $q] = pageArguments();
            $w = "1=1";
            $params = [];
            if ($q !== "") {
                $w .= ' AND kk_lower(last_name||\' \'||first_name) LIKE ?';
                $params[] = "%" . lower($q) . "%";
            }
            foreach (["department", "position", "status"] as $k) {
                if (!empty($_GET[$k])) {
                    $w .= " AND $k=?";
                    $params[] = text($_GET, $k, 1, 120);
                }
            }
            return ok(listing("members", $w, $params, "created_at DESC", fn($r) => memberView($r)));
        }
        if ($method === "GET" && $id) {
            return ok(memberView(required("members", $id)));
        }
        if ($method === "POST") {
            $userId = uid();
            writeRow("users", [
                "id" => $userId,
                "email" => emailValue($b),
                "password" => password_hash(passwordValue($b), PASSWORD_BCRYPT),
                "role" => choice($b, "role", ["ADMIN", "CHAIRMAN", "MEMBER"], "MEMBER"),
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            $id = uid();
            writeRow("members", [
                "id" => $id,
                "user_id" => $userId,
                ...memberData($b),
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            return ok(memberView(required("members", $id)), "Мүше қосылды", 201);
        }
        $m = required("members", (string) $id);
        $old = required("users", $m["user_id"]);
        if ($method === "PUT") {
            updateRow("members", $id, [...memberData($b), "updated_at" => now()]);
            return ok(memberView(required("members", $id)));
        }
        if ($method === "DELETE") {
            protectAdmin($old, [], true);
            run("DELETE FROM users WHERE id=?", [$old["id"]]);
            return ok();
        }
    }
    if ($resource === "users") {
        $u = requireUser(["ADMIN"]);
        if ($method === "GET" && $id) {
            return ok(userView(required("users", $id)));
        }
        if ($method === "GET") {
            return ok(listing("users", "1=1", [], "created_at DESC", fn($r) => userView($r)));
        }
        $old = required("users", (string) $id);
        if ($method === "PUT") {
            $d = [
                "email" => emailValue($b),
                "role" => choice($b, "role", ["ADMIN", "CHAIRMAN", "MEMBER"]),
                "is_active" => (int) boolValue($b["isActive"] ?? true),
                "version" => (int) $old["version"] + 1,
                "updated_at" => now(),
            ];
            if (!empty($b["password"])) {
                $d["password"] = password_hash(passwordValue($b), PASSWORD_BCRYPT);
            }
            protectAdmin($old, $d);
            updateRow("users", $id, $d);
            if ($old["id"] === $u["id"]) {
                $_SESSION["version"] = $d["version"];
            }
            return ok(userView(required("users", $id)));
        }
        if ($method === "DELETE") {
            protectAdmin($old, [], true);
            run("DELETE FROM users WHERE id=?", [$id]);
            return ok();
        }
    }
    if ($resource === "applications") {
        $u = requireUser();
        $m = one("SELECT * FROM members WHERE user_id=?", [$u["id"]]);
        if ($method === "GET" && !$id) {
            $w = staff() ? "1=1" : "member_id=?";
            $params = staff() ? [] : [$m["id"] ?? ""];
            if (!empty($_GET["status"])) {
                $w .= " AND status=?";
                $params[] = text($_GET, "status", 1, 40);
            }
            if (!empty($_GET["type"])) {
                $w .= " AND type=?";
                $params[] = text($_GET, "type", 1, 40);
            }
            return ok(
                listing("applications", $w, $params, "created_at DESC", fn($r) => appView($r)),
            );
        }
        if ($method === "POST" && !$id) {
            if (!$m || $m["status"] !== "ACTIVE") {
                throw new ApiError(403, "Белсенді мүшелік қажет");
            }
            $amount = $b["amount"] ?? null;
            if (
                $amount !== null &&
                $amount !== "" &&
                (!is_numeric($amount) || $amount < 0 || $amount > 100000000)
            ) {
                throw new ApiError(400, "Сома дұрыс емес");
            }
            $id = uid();
            writeRow("applications", [
                "id" => $id,
                "member_id" => $m["id"],
                "type" => choice($b, "type", ["MATERIAL", "ONE_TIME", "SOCIAL", "OTHER"]),
                "title" => text($b, "title", 3, 200),
                "description" => text($b, "description", 10, 20000),
                "amount_cents" =>
                    $amount === null || $amount === "" ? null : (int) round((float) $amount * 100),
                "status" => "NEW",
                "created_at" => now(),
                "updated_at" => now(),
            ]);
            writeRow("status_history", [
                "id" => uid(),
                "application_id" => $id,
                "changed_by" => $u["id"],
                "old_status" => null,
                "new_status" => "NEW",
                "created_at" => now(),
            ]);
            if (isset($b["fileIds"]) && (!is_array($b["fileIds"]) || count($b["fileIds"]) > 10)) {
                throw new ApiError(400, "Ең көбі 10 файл тіркеуге болады");
            }
            foreach ($b["fileIds"] ?? [] as $fid) {
                $f = required("files", $fid);
                if ($f["owner_id"] !== $u["id"]) {
                    throw new ApiError(403, "Файлға рұқсат жоқ");
                }
                writeRow("attachments", [
                    "id" => uid(),
                    "application_id" => $id,
                    "file_id" => $fid,
                    "created_at" => now(),
                ]);
            }
            notify(
                $u["id"],
                "Өтінішіңіз қабылданды",
                "Өтініш қарауға жіберілді",
                "APPLICATION",
                "#/applications/" . $id,
            );
            foreach (
                rows("SELECT id FROM users WHERE role IN ('ADMIN','CHAIRMAN') AND is_active=1")
                as $s
            ) {
                notify(
                    $s["id"],
                    "Жаңа өтініш",
                    text($b, "title", 3, 200),
                    "APPLICATION",
                    "#/admin/applications/" . $id,
                );
            }
            return ok(appView(required("applications", $id)), "Өтініш жіберілді", 201);
        }
        $a = appAccess((string) $id);
        if ($method === "GET") {
            $v = appView($a);
            $v["comments"] = array_map(
                fn($r) => [...camel($r), "author" => actorView($r["user_id"])],
                rows("SELECT * FROM comments WHERE application_id=? ORDER BY created_at", [$id]),
            );
            $v["history"] = array_map(
                fn($r) => [...camel($r), "author" => actorView($r["changed_by"])],
                rows("SELECT * FROM status_history WHERE application_id=? ORDER BY created_at", [
                    $id,
                ]),
            );
            $v["attachments"] = array_map(
                fn($r) => fileView($r),
                rows(
                    "SELECT f.* FROM files f JOIN attachments a ON a.file_id=f.id WHERE a.application_id=?",
                    [$id],
                ),
            );
            return ok($v);
        }
        if ($method === "POST" && $action === "comments") {
            writeRow("comments", [
                "id" => uid(),
                "application_id" => $id,
                "user_id" => $u["id"],
                "text" => text($b, "text", 1, 10000),
                "created_at" => now(),
            ]);
            $owner = required("members", $a["member_id"])["user_id"];
            if ($owner !== $u["id"]) {
                notify(
                    $owner,
                    "Өтінішке жауап келді",
                    text($b, "text", 1, 10000),
                    "APPLICATION",
                    "#/applications/" . $id,
                );
            }
            return ok();
        }
        if ($method === "POST" && $action === "attachments") {
            $f = required("files", text($b, "fileId", 24, 24));
            if ($f["owner_id"] !== $u["id"]) {
                throw new ApiError(403, "Файлға рұқсат жоқ");
            }
            writeRow("attachments", [
                "id" => uid(),
                "application_id" => $id,
                "file_id" => $f["id"],
                "created_at" => now(),
            ]);
            return ok();
        }
        if ($method === "POST" && $action === "status") {
            requireUser($staffRoles);
            $status = choice($b, "status", [
                "NEW",
                "IN_REVIEW",
                "NEEDS_INFO",
                "APPROVED",
                "REJECTED",
                "COMPLETED",
            ]);
            if ($status !== $a["status"]) {
                writeRow("status_history", [
                    "id" => uid(),
                    "application_id" => $id,
                    "changed_by" => $u["id"],
                    "old_status" => $a["status"],
                    "new_status" => $status,
                    "created_at" => now(),
                ]);
                updateRow("applications", $id, [
                    "status" => $status,
                    "updated_at" => now(),
                ]);
                notify(
                    required("members", $a["member_id"])["user_id"],
                    "Өтінішіңіздің статусы өзгертілді",
                    "Өтініштің жаңа күйін жеке кабинеттен көріңіз",
                    "APPLICATION",
                    "#/applications/" . $id,
                );
            }
            return ok();
        }
        if ($method === "DELETE") {
            if (!staff() && $a["status"] !== "NEW") {
                throw new ApiError(403, "Тек жаңа өтінішті жоюға болады");
            }
            run("DELETE FROM applications WHERE id=?", [$id]);
            return ok();
        }
        if ($method === "PUT") {
            if (!staff() && $a["status"] !== "NEW") {
                throw new ApiError(403, "Тек жаңа өтінішті өңдеуге болады");
            }
            updateRow("applications", $id, [
                "title" => text($b, "title", 3, 200),
                "description" => text($b, "description", 10, 20000),
                "updated_at" => now(),
            ]);
            return ok();
        }
    }
    if (in_array($resource, ["news", "documents", "events"], true)) {
        $table = $resource;
        if ($method === "GET") {
            if ($id) {
                $r =
                    $table === "news"
                        ? one("SELECT * FROM news WHERE slug=? OR id=?", [$id, $id])
                        : one("SELECT * FROM $table WHERE id=?", [$id]);
                if (!$r || ($table === "news" && $r["status"] !== "PUBLISHED" && !staff())) {
                    throw new ApiError(404, "Жазба табылмады");
                }
                return ok(contentView($table, $r));
            }
            [, , , $q] = pageArguments();
            $w = $table === "news" && !staff() ? "status='PUBLISHED' AND published_at<=?" : "1=1";
            $params = $table === "news" && !staff() ? [now()] : [];
            if ($q !== "") {
                $w .= " AND kk_lower(title) LIKE ?";
                $params[] = "%" . lower($q) . "%";
            }
            foreach ($table === "documents" ? ["category"] : ["status"] as $k) {
                if (!empty($_GET[$k])) {
                    $filter = text($_GET, $k, 1, 40);
                    if ($table === "events" && $filter === "UPCOMING") {
                        $w .= " AND status='UPCOMING' AND date>=?";
                        $params[] = gmdate("Y-m-d");
                    } elseif ($table === "events" && $filter === "PAST") {
                        $w .= " AND (status='PAST' OR (status='UPCOMING' AND date<?))";
                        $params[] = gmdate("Y-m-d");
                    } else {
                        $w .= " AND $k=?";
                        $params[] = $filter;
                    }
                }
            }
            return ok(
                listing(
                    $table,
                    $w,
                    $params,
                    $table === "events" ? "date ASC" : "created_at DESC",
                    fn($r) => contentView($table, $r),
                ),
            );
        }
        if (
            $table === "events" &&
            $action === "join" &&
            in_array($method, ["POST", "DELETE"], true)
        ) {
            $u = requireUser();
            $event = required("events", $id);
            if ($method === "POST") {
                if ($event["status"] !== "UPCOMING" || $event["date"] < gmdate("Y-m-d")) {
                    throw new ApiError(400, "Іс-шараға тіркелу аяқталған");
                }
                run(
                    "INSERT OR IGNORE INTO participants(event_id,user_id,created_at) VALUES(?,?,?)",
                    [$id, $u["id"], now()],
                );
            } else {
                run("DELETE FROM participants WHERE event_id=? AND user_id=?", [$id, $u["id"]]);
            }
            return ok();
        }
        $u = requireUser($table === "documents" ? ["ADMIN"] : $staffRoles);
        if ($method === "POST") {
            $id = uid();
            $d = contentData($table, $b, $u);
            $d += ["id" => $id, "created_at" => now(), "updated_at" => now()];
            if ($table === "news") {
                $d["author_id"] = $u["id"];
            }
            if ($table === "documents") {
                $d["uploaded_by"] = $u["id"];
            }
            writeRow($table, $d);
            if (
                $table === "news" &&
                $d["status"] === "PUBLISHED" &&
                boolValue($b["notify"] ?? false)
            ) {
                foreach (rows("SELECT id FROM users WHERE is_active=1") as $r) {
                    notify($r["id"], "Жаңа жаңалық", $d["title"], "NEWS", "#/news/" . $d["slug"]);
                }
            }
            return ok(contentView($table, required($table, $id)), "Жазба қосылды", 201);
        }
        required($table, (string) $id);
        if ($method === "PUT") {
            $d = contentData($table, $b, $u);
            updateRow($table, $id, [...$d, "updated_at" => now()]);
            if (
                $table === "news" &&
                $d["status"] === "PUBLISHED" &&
                boolValue($b["notify"] ?? false)
            ) {
                foreach (rows("SELECT id FROM users WHERE is_active=1") as $r) {
                    notify(
                        $r["id"],
                        "Жаңалық жарияланды",
                        $d["title"],
                        "NEWS",
                        "#/news/" . $d["slug"],
                    );
                }
            }
            return ok(contentView($table, required($table, $id)));
        }
        if ($method === "DELETE") {
            run("DELETE FROM $table WHERE id=?", [$id]);
            return ok();
        }
    }
    if ($resource === "notifications") {
        $u = requireUser();
        if ($method === "GET") {
            return ok([
                "items" => array_map(
                    fn($r) => camel($r),
                    rows(
                        "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
                        [$u["id"]],
                    ),
                ),
                "unread" => countSql(
                    "SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0",
                    [$u["id"]],
                ),
            ]);
        }
        if ($method === "PUT") {
            run(
                "UPDATE notifications SET is_read=1 WHERE user_id=?" .
                    ($id === "all" ? "" : " AND id=?"),
                $id === "all" ? [$u["id"]] : [$u["id"], $id],
            );
            return ok();
        }
    }
    if ($resource === "settings") {
        if ($method === "GET") {
            return ok(settings());
        }
        requireUser(["ADMIN"]);
        if ($method === "PUT") {
            keys($b, ["schoolName", "address", "phone", "email", "importantInfo"]);
            foreach ($b as $k => $v) {
                run(
                    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    [$k, text($b, $k, 0, 2000)],
                );
            }
            return ok(settings());
        }
    }
    if ($resource === "statistics") {
        requireUser($staffRoles);
        $days = (int) ($_GET["days"] ?? 365);
        if (!in_array($days, [7, 30, 90, 180, 365], true)) {
            throw new ApiError(400, "Мерзім дұрыс емес");
        }
        $since = gmdate("Y-m-d\TH:i:s\Z", time() - $days * 86400);
        $counts = [];
        foreach (["members", "applications", "news", "documents", "events"] as $t) {
            $counts[$t] = countSql("SELECT COUNT(*) FROM $t");
        }
        $counts["activeMembers"] = countSql("SELECT COUNT(*) FROM members WHERE status='ACTIVE'");
        $counts["activeApplications"] = countSql(
            "SELECT COUNT(*) FROM applications WHERE status IN ('NEW','IN_REVIEW','NEEDS_INFO')",
        );
        $counts["approvedApplications"] = countSql(
            "SELECT COUNT(*) FROM applications WHERE status IN ('APPROVED','COMPLETED')",
        );
        $charts = [];
        foreach (["members", "applications", "events"] as $t) {
            $charts[$t] = rows(
                "SELECT substr(created_at,1,7) label,COUNT(*) value FROM $t WHERE created_at>=? GROUP BY label ORDER BY label",
                [$since],
            );
        }
        foreach (["type", "status"] as $k) {
            $charts[$k] = rows(
                "SELECT $k label,COUNT(*) value FROM applications WHERE created_at>=? GROUP BY $k",
                [$since],
            );
        }
        return ok(["counts" => $counts, "charts" => $charts, "days" => $days]);
    }
    throw new ApiError(404, "API мекенжайы табылмады");
}
