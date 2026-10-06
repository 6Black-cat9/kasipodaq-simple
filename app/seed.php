<?php
declare(strict_types=1);
function seed(string $email, string $password, string $first, string $last, bool $demo): void
{
    $admin = uid();
    $stamp = now();
    writeRow("users", [
        "id" => $admin,
        "email" => $email,
        "password" => password_hash($password, PASSWORD_BCRYPT),
        "role" => "ADMIN",
        "created_at" => $stamp,
        "updated_at" => $stamp,
    ]);
    writeRow("members", [
        "id" => uid(),
        "user_id" => $admin,
        "first_name" => $first,
        "last_name" => $last,
        "middle_name" => "",
        "phone" => "+7 700 123 45 67",
        "position" => "Кәсіподақ әкімшісі",
        "department" => "Әкімшілік",
        "join_date" => gmdate("Y-m-d"),
        "status" => "ACTIVE",
        "created_at" => $stamp,
        "updated_at" => $stamp,
    ]);
    foreach (
        [
            "schoolName" => "№25 жалпы білім беретін мектеп",
            "address" => "Қызылорда қаласы, Абай көшесі, 25",
            "phone" => "+7 (7242) 25-25-25",
            "email" => "union@school.kz",
            "importantInfo" =>
                "Материалдық көмекке өтініштер ай сайынғы кәсіподақ отырысында қаралады. Сұрақтарыңыз бойынша кәсіподақ төрағасына хабарласыңыз.",
        ]
        as $k => $v
    ) {
        writeRow("settings", ["key" => $k, "value" => $v]);
    }
    if (!$demo) {
        return;
    }
    $names = [
        ["Айгерім", "Әбілова"],
        ["Ерлан", "Сәрсенов"],
        ["Дана", "Омарова"],
        ["Мұрат", "Қасымов"],
        ["Әсел", "Нұрланова"],
        ["Бекзат", "Әлібеков"],
        ["Гүлнар", "Жұмабаева"],
        ["Сәуле", "Төлегенова"],
        ["Азамат", "Ибраев"],
        ["Жанар", "Қалиева"],
        ["Руслан", "Мұқанов"],
        ["Мадина", "Ермекова"],
        ["Нұрлан", "Бекенов"],
        ["Айдана", "Сейітова"],
        ["Арман", "Дәулетов"],
    ];
    $members = [];
    $users = [];
    foreach ($names as $i => [$f, $l]) {
        $u = uid();
        $mid = uid();
        $users[] = $u;
        $members[] = $mid;
        $t = gmdate("Y-m-d\TH:i:s\Z", strtotime("-" . (15 - $i) . " days"));
        writeRow("users", [
            "id" => $u,
            "email" =>
                $i === 0
                    ? "chairman@example.com"
                    : ($i === 1
                        ? "member@example.com"
                        : "member" . ($i + 1) . "@example.com"),
            "password" => password_hash("Dev@12345!", PASSWORD_BCRYPT),
            "role" => $i === 0 ? "CHAIRMAN" : "MEMBER",
            "created_at" => $t,
            "updated_at" => $t,
        ]);
        writeRow("members", [
            "id" => $mid,
            "user_id" => $u,
            "first_name" => $f,
            "last_name" => $l,
            "middle_name" => "",
            "phone" => "+7 700 123 " . str_pad((string) $i, 2, "0", STR_PAD_LEFT) . " 00",
            "position" =>
                $i === 0 ? "Кәсіподақ төрағасы" : ($i % 3 === 0 ? "Педагог-психолог" : "Мұғалім"),
            "department" => ["Бастауыш сынып", "Гуманитарлық пәндер", "Жаратылыстану пәндері"][
                $i % 3
            ],
            "join_date" => substr($t, 0, 10),
            "status" => $i === 14 ? "INACTIVE" : "ACTIVE",
            "created_at" => $t,
            "updated_at" => $t,
        ]);
    }
    $titles = [
        "Емделуге материалдық көмек",
        "Отбасына біржолғы көмек",
        "Әлеуметтік қолдау",
        "Сауықтыруға жолдама",
        "Баланың оқуына көмек",
        "Медициналық шығындар",
        "Жас маманға қолдау",
        "Мәдени іс-шараға ұсыныс",
        "Тұрмыстық жағдайға көмек",
        "Кәсіподақ кеңесіне сұрақ",
    ];
    $statuses = ["NEW", "IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED", "COMPLETED"];
    foreach ($titles as $i => $title) {
        $id = uid();
        $owner = $i < 3 ? 1 : $i;
        $t = gmdate("Y-m-d\TH:i:s\Z", strtotime("-" . ($i + 1) . " days"));
        writeRow("applications", [
            "id" => $id,
            "member_id" => $members[$owner],
            "type" => ["MATERIAL", "ONE_TIME", "SOCIAL", "OTHER"][$i % 4],
            "title" => $title,
            "description" =>
                "Құрметті кәсіподақ комитеті! Осы өтінішімді қарап, тиісті көмек көрсетулеріңізді сұраймын. Қажетті мәліметтерді қосымша ұсынуға дайынмын.",
            "amount_cents" => $i % 4 === 3 ? null : 5000000 + $i * 1000000,
            "status" => $statuses[$i % 6],
            "created_at" => $t,
            "updated_at" => $stamp,
        ]);
        writeRow("status_history", [
            "id" => uid(),
            "application_id" => $id,
            "changed_by" => $users[$owner],
            "old_status" => null,
            "new_status" => "NEW",
            "created_at" => $t,
        ]);
        if ($i % 6 !== 0) {
            writeRow("status_history", [
                "id" => uid(),
                "application_id" => $id,
                "changed_by" => $admin,
                "old_status" => "NEW",
                "new_status" => $statuses[$i % 6],
                "created_at" => $stamp,
            ]);
        }
        if ($i % 3 === 0) {
            writeRow("comments", [
                "id" => uid(),
                "application_id" => $id,
                "user_id" => $admin,
                "text" => "Өтінішіңіз тіркелді. Кәсіподақ комитетінің отырысында қаралады.",
                "created_at" => $stamp,
            ]);
        }
        notify(
            $users[$owner],
            "Өтінішіңіз қабылданды",
            $title,
            "APPLICATION",
            "#/applications/" . $id,
        );
    }
    $news = [
        "Ұстаздар күні: бірлігіміз — берекеміз",
        "Кәсіподақтың жаңа оқу жылына арналған жоспары",
        "Қызметкерлердің әлеуметтік қолдауы кеңейтілді",
        "Мектеп ұжымы спорттық сайысқа қатысты",
        "Жас мамандармен кездесу өтті",
    ];
    foreach ($news as $i => $title) {
        $id = uid();
        $t = gmdate("Y-m-d\TH:i:s\Z", strtotime("-" . ($i + 1) . " days"));
        writeRow("news", [
            "id" => $id,
            "title" => $title,
            "slug" => "union-news-" . ($i + 1),
            "short_description" =>
                "Мектеп кәсіподағының жаңалықтары: ұжымымыздың жетістіктері, ортақ бастамалар және қызметкерлерге қолдау.",
            "content" =>
                'Біздің кәсіподақ қызметкерлердің құқықтары мен мүдделерін қорғауды басты міндет деп санайды.\n\nМектеп ұжымымен бірге жаңа бастамалар жүзеге асырылды. Кездесуде еңбек жағдайлары, әлеуметтік көмек және алдағы іс-шаралар талқыланды.\n\nБарлық кәсіподақ мүшелерін белсенді қатысуға шақырамыз. Сұрақтарыңыз бен ұсыныстарыңызды жеке кабинет арқылы жіберуге болады.',
            "image" => "assets/images/news-" . ($i + 1) . ".jpg",
            "author_id" => $admin,
            "status" => "PUBLISHED",
            "published_at" => $t,
            "created_at" => $t,
            "updated_at" => $t,
        ]);
    }
    $docs = [
        "Кәсіподақ жарғысы",
        "Материалдық көмек көрсету ережесі",
        "Жиналыс хаттамасы",
        "Жылдық жұмыс есебі",
        "Ұжымдық шарт",
    ];
    global $storagePath, $newFiles;
    foreach ($docs as $i => $title) {
        $fid = uid();
        $filename = $fid . ".pdf";
        $source = dirname(__DIR__) . "/seed-documents/seed-document-" . ($i + 1) . ".pdf";
        $target = $storagePath . "/uploads/" . $filename;
        if (!copy($source, $target)) {
            throw new RuntimeException("Seed file unavailable");
        }
        chmod($target, 0600);
        $newFiles[] = $target;
        writeRow("files", [
            "id" => $fid,
            "original_name" => "document-" . ($i + 1) . ".pdf",
            "stored_name" => $filename,
            "mime" => "application/pdf",
            "size" => filesize($target),
            "owner_id" => $admin,
            "created_at" => $stamp,
        ]);
        writeRow("documents", [
            "id" => uid(),
            "title" => $title,
            "description" => "Мектеп кәсіподағының ресми құжаты.",
            "category" => ["RULES", "REGULATIONS", "MINUTES", "REPORTS", "RESOLUTIONS"][$i],
            "file_id" => $fid,
            "uploaded_by" => $admin,
            "created_at" => $stamp,
            "updated_at" => $stamp,
        ]);
    }
    foreach (
        [
            "Кәсіподақ комитетінің отырысы",
            "Ұстаздар күніне арналған кеш",
            "Денсаулық күні",
            "Жас мамандар форумы",
            "Ұжымдық кездесу",
        ]
        as $i => $title
    ) {
        writeRow("events", [
            "id" => uid(),
            "title" => $title,
            "description" =>
                "Мектеп қызметкерлерін ортақ іс-шараға шақырамыз. Ұжымдық жұмысты дамыту, тәжірибе алмасу және жақсы көңіл күй үшін бірге болайық.",
            "date" => gmdate("Y-m-d", strtotime(($i < 3 ? "+" : "-") . ($i + 1) * 7 . " days")),
            "start_time" => "15:00",
            "end_time" => "17:00",
            "location" => "Мектептің мәжіліс залы",
            "image" => "assets/images/event-" . ($i + 1) . ".jpg",
            "organizer" => "Мектеп кәсіподағы",
            "status" => $i < 3 ? "UPCOMING" : "PAST",
            "created_at" => $stamp,
            "updated_at" => $stamp,
        ]);
    }
    notify(
        $admin,
        "Қош келдіңіз!",
        "Кәсіподақ жүйесі дайын. Барлық бөлімдерді осы жерден басқара аласыз.",
        "SYSTEM",
        "#/admin",
    );
}
