const BASE = new URL("../", import.meta.url),
  root = document.querySelector("#app");
let state = { csrf: "", user: null, settings: {}, installed: true },
  renderId = 0;
const labels = {
  ADMIN: "Әкімші",
  CHAIRMAN: "Төраға",
  MEMBER: "Мүше",
  ACTIVE: "Белсенді",
  INACTIVE: "Белсенді емес",
  NEW: "Жаңа",
  IN_REVIEW: "Қаралуда",
  NEEDS_INFO: "Қосымша ақпарат қажет",
  APPROVED: "Мақұлданды",
  REJECTED: "Қабылданбады",
  COMPLETED: "Орындалды",
  MATERIAL: "Материалдық көмек",
  ONE_TIME: "Біржолғы көмек",
  SOCIAL: "Әлеуметтік көмек",
  OTHER: "Басқа",
  DRAFT: "Жоба",
  PUBLISHED: "Жарияланған",
  UPCOMING: "Алда",
  PAST: "Өтті",
  CANCELLED: "Болдырылмады",
  RULES: "Ережелер",
  RESOLUTIONS: "Қаулылар",
  MINUTES: "Хаттамалар",
  ORDERS: "Бұйрықтар",
  REPORTS: "Есептер",
  REGULATIONS: "Нормативтік құжаттар",
};
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const months = [
  "қаңтар",
  "ақпан",
  "наурыз",
  "сәуір",
  "мамыр",
  "маусым",
  "шілде",
  "тамыз",
  "қыркүйек",
  "қазан",
  "қараша",
  "желтоқсан",
];
const url = (v) => new URL(v || "", BASE).href,
  fmt = (v) => {
    if (!v) return "—";
    const d = new Date(v.length === 10 ? v + "T12:00:00Z" : v);
    const parts = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        timeZone: "Asia/Qyzylorda",
      }).formatToParts(d),
      part = (k) => +parts.find((p) => p.type === k).value;
    return `${part("day")} ${months[part("month") - 1]} ${part("year")}`;
  };
const money = (v) =>
  v === null || v === undefined ? "—" : new Intl.NumberFormat("kk-KZ").format(v) + " ₸";
const fullname = (m) => [m?.lastName, m?.firstName, m?.middleName].filter(Boolean).join(" "),
  isStaff = () => ["ADMIN", "CHAIRMAN"].includes(state.user?.role),
  isAdmin = () => state.user?.role === "ADMIN";
async function api(path, method = "GET", data) {
  const target = new URL("api.php", BASE);
  const [route, query] = path.split("?");
  target.searchParams.set("path", route);
  if (query) for (const [k, v] of new URLSearchParams(query)) target.searchParams.set(k, v);
  const options = { method, credentials: "same-origin", headers: {} };
  if (method !== "GET") {
    options.headers["X-CSRF-Token"] = state.csrf;
    if (data instanceof FormData) options.body = data;
    else {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data ?? {});
    }
  }
  let response;
  try {
    response = await fetch(target, options);
  } catch {
    throw Object.assign(new Error("Серверге қосылу мүмкін емес. Интернет байланысын тексеріңіз."), {
      status: 0,
    });
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw Object.assign(new Error("Сервер жауабы дұрыс емес"), { status: 500 });
  }
  if (!result.success)
    throw Object.assign(new Error(result.message), {
      status: response.status,
      errors: result.errors,
    });
  return result.data;
}
function toast(msg, bad = false) {
  const el = document.createElement("div");
  el.className = "toast" + (bad ? " error-toast" : "");
  el.textContent = msg;
  const stack = document.querySelector("#toasts");
  while (stack.children.length >= 3) stack.firstElementChild.remove();
  stack.append(el);
  setTimeout(() => el.remove(), 5000);
}
function badge(v) {
  return `<span class="tag ${["NEW", "NEEDS_INFO", "DRAFT"].includes(v) ? "yellow" : ["REJECTED", "INACTIVE", "CANCELLED"].includes(v) ? "red" : v === "IN_REVIEW" ? "blue" : ""}">${esc(labels[v] || v)}</span>`;
}
function link(path, text, cls = "btn") {
  return `<a class="${cls}" href="#${path}">${text}</a>`;
}
function brand() {
  return `<a href="#/" class="brand"><span class="logo" aria-hidden="true">❧</span><span>КӘСІПОДАҚ<small>Мектеп кәсіподағын басқару платформасы</small></span></a>`;
}
function shell(content, path) {
  const publicNav = [
    ["/", "Басты бет"],
    ["/news", "Жаңалықтар"],
    ["/documents", "Құжаттар"],
    ["/events", "Іс-шаралар"],
  ];
  if (isStaff())
    publicNav.splice(1, 0, ["/admin/members", "Мүшелер"], ["/admin/applications", "Өтініштер"]);
  return `<div class="topline"><div class="container"><span>Бірлік. Қолдау. Сенімді болашақ.</span><span>${esc(state.settings.schoolName)} &nbsp; · &nbsp; ${esc(state.settings.phone)}</span></div></div><header class="header"><div class="container header-inner">${brand()}<nav class="nav" id="nav" aria-label="Негізгі мәзір">${publicNav.map(([p, t]) => `<a href="#${p}" class="${path === p ? "active" : ""}">${t}</a>`).join("")}${isStaff() ? `<a href="#/admin/statistics">Статистика</a>` : ""}</nav><div class="account">${state.user ? `<button class="iconbtn" data-action="notifications" aria-label="Хабарламалар"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg><span class="unread" id="unread" hidden></span></button><a href="#/profile" class="iconbtn avatar" aria-label="Профиль">${state.user.member?.avatar ? `<img src="${esc(url(state.user.member.avatar))}" alt="">` : esc(state.user.member?.firstName?.[0] || "А")}</a><button class="iconbtn" data-action="logout" aria-label="Шығу"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M9 4H4v16h5M14 7l5 5-5 5M9 12h10"/></svg></button>` : link("/login", "Кіру →")}<button class="iconbtn mobile-toggle" data-action="menu" aria-label="Мәзірді ашу" aria-expanded="false">☰</button></div></div></header><main id="main" class="container">${content}</main><footer class="footer"><div class="container"><div class="footer-grid"><div>${brand()}<p>Қызметкерлердің құқығы мен мүддесін бірге қорғаймыз.<br>Әрбір мүше — біздің үлкен ұжымның маңызды бөлігі.</p></div><div><h3>Пайдалы сілтемелер</h3><p>${link("/documents", "Құжаттар", "link")}<br>${link("/news", "Жаңалықтар", "link")}<br>${link("/events", "Іс-шаралар", "link")}</p></div><div><h3>Бізбен байланыс</h3><p>${esc(state.settings.address)}<br>${esc(state.settings.phone)}<br>${esc(state.settings.email)}</p></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} КӘСІПОДАҚ. Барлық құқықтар қорғалған.</span><span>Бірге күштіміз. Бірге алға.</span></div></div></footer>`;
}
function head(title, description = "", action = "") {
  return `<div class="page-head"><div><div class="eyebrow">МЕКТЕП КӘСІПОДАҒЫ</div><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>${action}</div>`;
}
function empty(title = "Әзірге жазбалар жоқ", desc = "Жаңа мәліметтер осы жерде көрсетіледі.") {
  return `<div class="empty"><div class="symbol">❧</div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;
}
function page(content) {
  return `<div class="page">${content}</div>`;
}
function workspace(content, path) {
  const entries = isStaff()
    ? [
        ["/admin", "◈", "Шолу"],
        ["/admin/members", "♙", "Мүшелер"],
        ["/admin/applications", "▤", "Өтініштер"],
        ["/admin/news", "▧", "Жаңалықтар"],
        ["/admin/documents", "▥", "Құжаттар"],
        ["/admin/events", "▦", "Іс-шаралар"],
        ["/admin/statistics", "▨", "Статистика"],
        ...(isAdmin()
          ? [
              ["/admin/users", "♧", "Қолданушылар"],
              ["/admin/settings", "⚙", "Баптаулар"],
            ]
          : []),
      ]
    : [
        ["/cabinet", "◈", "Жеке кабинет"],
        ["/applications", "▤", "Менің өтініштерім"],
        ["/applications/new", "＋", "Өтініш беру"],
        ["/profile", "♙", "Профиль"],
      ];
  return page(
    `<div class="workspace"><aside class="sidebar" aria-label="Кабинет мәзірі"><small>${isStaff() ? "БАСҚАРУ ПАНЕЛІ" : "ЖЕКЕ КАБИНЕТ"}</small>${entries.map(([p, i, t]) => `<a href="#${p}" class="${path === p ? "active" : ""}"><span aria-hidden="true">${i}</span>${t}</a>`).join("")}</aside><div>${content}</div></div>`,
  );
}
function statsCards(counts, admin = false) {
  const entries = admin
    ? [
        ["members", "Мүшелер саны", "♙"],
        ["activeMembers", "Белсенді мүшелер", "✓"],
        ["activeApplications", "Белсенді өтініштер", "▤"],
        ["approvedApplications", "Мақұлданған өтініштер", "♧"],
        ["news", "Жаңалықтар", "▧"],
        ["documents", "Құжаттар", "▥"],
        ["events", "Іс-шаралар", "▦"],
      ]
    : [
        ["members", "Кәсіподақ мүшелері", "♙"],
        ["applications", "Белсенді өтініштер", "▤"],
        ["events", "Алдағы іс-шаралар", "▦"],
        ["documents", "Құжаттар", "▥"],
      ];
  return `<div class="stats">${entries.map(([k, l, i]) => `<div class="stat"><div class="stat-icon" aria-hidden="true">${i}</div><div><strong>${esc(counts[k] ?? 0)}</strong><p>${l}</p></div></div>`).join("")}</div>`;
}
function newsCard(n) {
  return `<article class="card">${n.image ? `<a href="#/news/${esc(n.slug)}"><img class="card-image" src="${esc(url(n.image))}" alt="${esc(n.title)}" loading="lazy"></a>` : ""}<div class="card-body"><div class="card-meta"><span class="tag">Жаңалық</span><time>${fmt(n.publishedAt || n.createdAt)}</time></div><h3><a href="#/news/${esc(n.slug)}">${esc(n.title)}</a></h3><p>${esc(n.shortDescription)}</p><div class="card-footer">${link("/news/" + n.slug, "Толығырақ →", "link")}<span>КӘСІПОДАҚ</span></div></div></article>`;
}
function eventRow(e) {
  const d = new Date(e.date + "T12:00:00Z");
  return `<a class="event-row" href="#/events/${esc(e.id)}"><div class="date-block"><strong>${d.getUTCDate()}</strong><small>${months[d.getUTCMonth()].slice(0, 3)}</small></div><div><h3>${esc(e.title)}</h3><p>◷ ${esc(e.startTime)} &nbsp; · &nbsp; ${esc(e.location)}</p></div><span class="link" style="margin-left:auto">→</span></a>`;
}
async function home() {
  const [c, n, e] = await Promise.all([
    api("overview"),
    api("news?pageSize=3"),
    api("events?status=UPCOMING&pageSize=3"),
  ]);
  return `<section class="hero"><div class="hero-text"><div class="eyebrow">БІРГЕ КҮШТІМІЗ</div><h1>Кәсіподақ —<br>қызметкерлердің <em>құқығы мен мүддесін</em> қорғау орталығы</h1><p>Біз әр қызметкерді қолдаймыз, ортақ мүддемізді қорғаймыз және сенімді болашақты бірге құрамыз.</p><div class="actions">${link(state.user ? "/applications/new" : "/login", "Өтініш беру →", "btn gold")}${link("/news", "Жаңалықтарды көру →", "btn secondary")}</div></div><div class="hero-photo" style="background-image:url('${url("assets/images/hero-community.jpg")}')" role="img" aria-label="Мектептің бірлікке ұмтылған ұжымы"><div class="hero-note"><span>❧</span>Бір ұжым. Бір мақсат. Бір кәсіподақ.</div></div></section>${statsCards(c)}<section><div class="section-head"><div><div class="eyebrow">КӘСІПОДАҚ ӨМІРІ</div><h2>Соңғы жаңалықтар</h2><p>Ұжымымыздың жаңалықтары мен маңызды оқиғалары</p></div>${link("/news", "Барлық жаңалықтар →", "link")}</div><div class="grid">${n.items.map(newsCard).join("") || empty()}</div></section><div class="lower-grid"><section class="panel"><div class="section-head" style="margin-top:0"><h2>Алдағы іс-шаралар</h2>${link("/events", "Барлығы →", "link")}</div>${e.items.map(eventRow).join("") || empty()}</section><aside class="notice"><div class="eyebrow">БІЛГЕН МАҢЫЗДЫ</div><h3>Сізге әрдайым қолдау көрсетеміз</h3><p>${esc(state.settings.importantInfo)}</p>${link("/documents", "Құжаттармен танысу →", "btn secondary")}</aside></div>`;
}
const options = (values, selected = "", blank = null) =>
  (blank !== null ? `<option value="">${esc(blank)}</option>` : "") +
  values
    .map(
      (v) =>
        `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(labels[v] || v)}</option>`,
    )
    .join("");
function field(name, label, value = "", type = "text", extra = "") {
  return `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></div>`;
}
function select(name, label, values, value = "", blank = null) {
  return `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><select id="f-${esc(name)}" name="${esc(name)}">${options(values, value, blank)}</select></div>`;
}
function textarea(name, label, value = "", min = 0) {
  return `<div class="field wide"><label for="f-${esc(name)}">${esc(label)}</label><textarea id="f-${esc(name)}" name="${esc(name)}" minlength="${min}" maxlength="50000" ${min ? "required" : ""}>${esc(value)}</textarea></div>`;
}
function uploadField(name, label, accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png") {
  return `<div class="field wide"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="file" accept="${accept}"><small>Файл көлемі: ең көбі 10 МБ</small></div>`;
}
function login(setup = false) {
  return page(
    `<div class="auth-wrap"><div class="auth-art">${brand().replace('class="brand"', 'class="brand" style="color:white"')}<h2>${setup ? "Кәсіподақ платформасын іске қосыңыз" : "Жеке кабинетке қош келдіңіз"}</h2><p>Барлық өтініштер, құжаттар мен маңызды жаңалықтар — бір жерде. Біз сіздің мүддеңізді қорғаймыз.</p></div><div class="auth-form"><h2>${setup ? "Алғашқы баптау" : "Жүйеге кіру"}</h2><p>${setup ? "Әкімші аккаунтын жасаңыз. Бұл қадам тек бір рет орындалады." : "Жалғастыру үшін email мен құпиясөзді енгізіңіз."}</p><form data-form="${setup ? "setup" : "login"}">${setup ? field("firstName", "Аты", "", "text", 'required maxlength="80"') + field("lastName", "Тегі", "", "text", 'required maxlength="80"') : ""}${field("email", "Email", "", "email", 'required autocomplete="username" maxlength="254"')}${field("password", "Құпиясөз", "", "password", `required ${setup ? 'minlength="8"' : ""} maxlength="72" autocomplete="${setup ? "new-password" : "current-password"}"`)}${setup ? '<label class="check"><input type="checkbox" name="demo" checked>Қазақ тіліндегі демо деректерді қосу</label><div class="helper">Демо режимінде төраға мен мүше аккаунттары қосылады. Нақты пайдалануға көшкенде олардың құпиясөздерін өзгертіңіз.</div>' : ""}<button class="btn" type="submit">${setup ? "Жүйені орнату" : "Кіру"} →</button></form></div></div>`,
  );
}
function pagination(data) {
  const total = Math.ceil(data.total / data.pageSize);
  return `<div class="pagination"><span>${data.total} жазба · ${data.page}/${Math.max(total, 1)} бет</span><div class="actions">${data.page > 1 ? `<button class="btn secondary small" data-action="page" data-page="${data.page - 1}">← Алдыңғы</button>` : ""}${data.page < total ? `<button class="btn secondary small" data-action="page" data-page="${data.page + 1}">Келесі →</button>` : ""}</div></div>`;
}
function table(headers, body) {
  return body.length
    ? `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : empty();
}
function person(m) {
  return `<div class="person"><span class="avatar">${m.avatar ? `<img src="${esc(url(m.avatar))}" alt="">` : esc(m.firstName?.[0])}</span><div>${esc(fullname(m))}<small>${esc(m.position)}</small></div></div>`;
}
const deleteButton = (resource, id) =>
  `<button class="btn secondary small" data-action="delete" data-resource="${resource}" data-id="${esc(id)}" aria-label="Жою">Жою</button>`;
function editButtons(resource, r) {
  return `<div class="row-actions">${link("/admin/" + resource + "/" + (resource === "news" ? r.slug : r.id) + "/edit", "Өңдеу", "btn secondary small")}${deleteButton(resource, r.id)}</div>`;
}
function filters(fields = "", search = true) {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  return `<form class="filters" data-form="filters">${search ? `<input aria-label="Іздеу" name="q" value="${esc(q.get("q") || "")}" placeholder="Іздеу…">` : ""}${fields}<button class="btn" type="submit">Қолдану</button><button class="btn secondary" type="button" data-action="resetfilters">Тазалау</button></form>`;
}
async function contentList(resource, admin = false) {
  const query = location.hash.split("?")[1] || "";
  const data = await api(resource + "?" + query);
  const titles = {
    news: "Жаңалықтар",
    documents: "Құжаттар",
    events: "Іс-шаралар",
  };
  let controls = "";
  if (resource === "documents")
    controls = `<select name="category" aria-label="Құжат категориясы">${options(["RULES", "RESOLUTIONS", "MINUTES", "ORDERS", "REPORTS", "REGULATIONS", "OTHER"], new URLSearchParams(query).get("category"), "Барлық категориялар")}</select>`;
  if (resource === "events")
    controls = `<select name="status" aria-label="Іс-шара күйі">${options(["UPCOMING", "PAST", "CANCELLED"], new URLSearchParams(query).get("status"), "Барлық іс-шаралар")}</select>`;
  let body;
  if (admin) {
    body = table(
      ["Атауы", resource === "documents" ? "Категория" : "Күйі", "Күні", "Әрекет"],
      data.items.map((r) => [
        esc(r.title),
        badge(resource === "documents" ? r.category : r.status),
        fmt(r.date || r.createdAt),
        resource === "documents" && !isAdmin() ? "—" : editButtons(resource, r),
      ]),
    );
  } else if (resource === "news")
    body = `<div class="grid">${data.items.map(newsCard).join("")}</div>`;
  else if (resource === "events")
    body = `<div class="grid">${data.items.map((e) => `<article class="card">${e.image ? `<img class="card-image" src="${esc(url(e.image))}" alt="${esc(e.title)}" loading="lazy">` : ""}<div class="card-body"><div class="card-meta">${badge(e.status)}<span>${fmt(e.date)}</span></div><h3>${esc(e.title)}</h3><p>◷ ${esc(e.startTime)} &nbsp; · &nbsp; ${esc(e.location)}</p><div class="card-footer">${link("/events/" + e.id, "Толығырақ →", "link")}<span>${e.participants} қатысушы</span></div></div></article>`).join("")}</div>`;
  else
    body = `<div class="doc-grid">${data.items.map((d) => `<article class="doc"><div class="doc-icon">${esc(d.fileName.split(".").pop().toUpperCase())}</div><div><h3>${esc(d.title)}</h3><p>${esc(d.description)}</p><p>${esc(labels[d.category])} · ${(d.fileSize / 1024).toFixed(0)} КБ · ${fmt(d.createdAt)}</p><div class="actions"><a class="link" href="${esc(url(d.fileUrl))}" target="_blank" rel="noopener">Көру →</a><a class="link" href="${esc(url(d.fileUrl + "&download=1"))}">Жүктеу ↓</a></div></div></article>`).join("")}</div>`;
  const html =
    head(
      titles[resource],
      admin ? "Мәліметтерді басқару және жаңарту" : "Кәсіподақтың өзекті мәліметтері",
      admin && (resource !== "documents" || isAdmin())
        ? link("/admin/" + resource + "/new", "＋ Қосу")
        : "",
    ) +
    filters(controls) +
    (!data.items.length ? empty() : body) +
    pagination(data);
  return admin ? workspace(html, "/admin/" + resource) : page(html);
}
async function detail(resource, id) {
  const r = await api(resource + "/" + encodeURIComponent(id));
  return page(
    `<article class="article"><div class="breadcrumbs">${link("/", "Басты бет", "link")} / ${link("/" + resource, resource === "news" ? "Жаңалықтар" : "Іс-шаралар", "link")}</div>${head(r.title)}<div class="card-meta">${badge(r.status)}<span>${fmt(r.date || r.publishedAt)}</span></div>${r.image ? `<img class="cover" src="${esc(url(r.image))}" alt="${esc(r.title)}">` : ""}${resource === "events" ? `<div class="panel spacer"><div class="detail-list"><div><small>Уақыты</small><strong>${esc(r.startTime)} — ${esc(r.endTime)}</strong></div><div><small>Өтетін орны</small><strong>${esc(r.location)}</strong></div><div><small>Ұйымдастырушы</small><strong>${esc(r.organizer)}</strong></div><div><small>Қатысушылар</small><strong>${r.participants}</strong></div></div>${r.status === "UPCOMING" ? (state.user ? `<button class="btn" data-action="join" data-id="${r.id}" data-joined="${r.joined}">${r.joined ? "Қатысудан бас тарту" : "Іс-шараға қатысу →"}</button>` : link("/login", "Қатысу үшін кіріңіз")) : ""}</div>` : ""}<div class="panel spacer"><div class="prose">${esc(r.content || r.description).replace(/\\n/g, "\n")}</div></div></article>`,
  );
}
async function memberList() {
  const query = location.hash.split("?")[1] || "",
    q = new URLSearchParams(query),
    data = await api("members?" + query);
  const all = await api("members/options");
  const departments = all.departments,
    positions = all.positions;
  return workspace(
    head(
      "Кәсіподақ мүшелері",
      "Ұжым мүшелерінің тізімі және жеке мәліметтері",
      isAdmin() ? link("/admin/members/new", "＋ Мүше қосу") : "",
    ) +
      filters(
        `<select name="department" aria-label="Бөлім">${options(departments, q.get("department"), "Барлық бөлімдер")}</select><select name="position" aria-label="Қызмет">${options(positions, q.get("position"), "Барлық қызметтер")}</select><select name="status" aria-label="Статус">${options(["ACTIVE", "INACTIVE"], q.get("status"), "Барлық статустар")}</select>`,
      ) +
      table(
        ["ID / Мүше", "Бөлім", "Байланыс", "Кірген күні", "Статус", "Әрекет"],
        data.items.map((m) => [
          `<small class="muted">${esc(m.id.slice(0, 6))}</small>${person(m)}`,
          esc(m.department),
          `${esc(m.phone)}<br><small>${esc(m.user.email)}</small>`,
          fmt(m.joinDate),
          badge(m.status),
          `<div class="row-actions">${link("/admin/members/" + m.id, isAdmin() ? "Өңдеу" : "Көру", "btn secondary small")}${isAdmin() ? deleteButton("members", m.id) : ""}</div>`,
        ]),
      ) +
      pagination(data),
    "/admin/members",
  );
}
async function memberForm(id) {
  const m = id ? await api("members/" + id) : {};
  const readOnly = !isAdmin();
  return workspace(
    head(id ? "Мүше мәліметтері" : "Жаңа мүше", "Жеке мәліметтер және жұмыс орны") +
      `<div class="panel form-panel"><form data-form="member" data-id="${id || ""}"><fieldset ${readOnly ? "disabled" : ""} style="border:0;padding:0;margin:0"><div class="form-grid">${field("firstName", "Аты", m.firstName, "text", 'required maxlength="80"')}${field("lastName", "Тегі", m.lastName, "text", 'required maxlength="80"')}${field("middleName", "Әкесінің аты", m.middleName, "text", 'maxlength="80"')}${field("phone", "Телефон", m.phone, "tel", 'maxlength="30"')}${field("position", "Қызметі", m.position, "text", 'required maxlength="120"')}${field("department", "Бөлімі", m.department, "text", 'required maxlength="120"')}${field("joinDate", "Кәсіподаққа кірген күні", m.joinDate || new Date().toISOString().slice(0, 10), "date", "required")}${select("status", "Мүшелік статусы", ["ACTIVE", "INACTIVE"], m.status || "ACTIVE")}${uploadField("avatarFile", "Мүше суреті", ".jpg,.jpeg,.png")}<input type="hidden" name="avatar" value="${esc(m.avatar || "")}">${!id ? field("email", "Email", "", "email", "required") + field("password", "Құпиясөз", "", "password", 'required minlength="8" maxlength="72"') + select("role", "Рөл", ["ADMIN", "CHAIRMAN", "MEMBER"], "MEMBER") : ""}</div>${!readOnly ? '<button class="btn" type="submit">Сақтау</button>' : ""}</fieldset></form></div>`,
    "/admin/members",
  );
}
async function contentForm(resource, id) {
  const r = id ? await api(resource + "/" + id) : {};
  let fields = field("title", "Тақырып", r.title, "text", 'required minlength="3" maxlength="200"');
  if (resource === "news")
    fields +=
      field(
        "slug",
        "Сілтеме (slug)",
        r.slug,
        "text",
        'required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="180"',
      ) +
      textarea("shortDescription", "Қысқаша сипаттама", r.shortDescription, 3) +
      textarea("content", "Толық мәтін", r.content, 3) +
      select("status", "Статус", ["DRAFT", "PUBLISHED"], r.status || "DRAFT") +
      '<label class="check"><input type="checkbox" name="notify">Мүшелерге хабарлама жіберу</label>';
  else fields += textarea("description", "Сипаттама", r.description);
  if (resource === "documents")
    fields +=
      select(
        "category",
        "Категория",
        ["RULES", "RESOLUTIONS", "MINUTES", "ORDERS", "REPORTS", "REGULATIONS", "OTHER"],
        r.category || "RULES",
      ) +
      uploadField("file", "Құжат файлы") +
      (r.fileName ? `<p class="wide muted">Қазіргі файл: ${esc(r.fileName)}</p>` : "");
  if (resource === "events")
    fields +=
      field("date", "Күні", r.date || new Date().toISOString().slice(0, 10), "date", "required") +
      field("startTime", "Басталуы", r.startTime || "15:00", "time", "required") +
      field("endTime", "Аяқталуы", r.endTime || "17:00", "time", "required") +
      field("location", "Өтетін орны", r.location, "text", 'required minlength="2"') +
      field(
        "organizer",
        "Ұйымдастырушы",
        r.organizer || state.settings.schoolName,
        "text",
        'required minlength="2"',
      ) +
      select("status", "Статус", ["UPCOMING", "PAST", "CANCELLED"], r.status || "UPCOMING");
  if (resource !== "documents")
    fields +=
      uploadField("imageFile", "Мұқаба суреті", ".jpg,.jpeg,.png") +
      `<input type="hidden" name="image" value="${esc(r.image || "")}">` +
      (r.image
        ? `<div class="wide"><img src="${esc(url(r.image))}" alt="Қазіргі сурет" style="max-width:200px;border-radius:8px"><label class="check"><input type="checkbox" name="removeImage">Суретті алып тастау</label></div>`
        : "");
  return workspace(
    head(
      (id ? "Өңдеу: " : "Қосу: ") +
        { news: "жаңалық", documents: "құжат", events: "іс-шара" }[resource],
    ) +
      `<div class="panel form-panel"><form data-form="content" data-resource="${resource}" data-id="${esc(r.id || "")}" data-file-id="${esc(r.fileId || "")}"><div class="form-grid">${fields}</div><div class="actions"><button type="submit" class="btn">Сақтау</button>${link("/admin/" + resource, "Болдырмау", "btn secondary")}</div></form></div>`,
    "/admin/" + resource,
  );
}
async function applicationList(admin = false) {
  const query = location.hash.split("?")[1] || "",
    q = new URLSearchParams(query),
    d = await api("applications?" + query);
  const prefix = admin ? "/admin" : "";
  return workspace(
    head(
      admin ? "Өтініштер" : "Менің өтініштерім",
      "Өтініштерді қарау және олардың орындалуын бақылау",
      link("/applications/new", "＋ Өтініш беру"),
    ) +
      filters(
        `<select name="status" aria-label="Статус">${options(["NEW", "IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED", "COMPLETED"], q.get("status"), "Барлық статустар")}</select><select name="type" aria-label="Өтініш түрі">${options(["MATERIAL", "ONE_TIME", "SOCIAL", "OTHER"], q.get("type"), "Барлық түрлер")}</select>`,
        false,
      ) +
      table(
        ["№ / Тақырып", ...(admin ? ["Мүше"] : []), "Түрі", "Сома", "Статус", "Күні", "Әрекет"],
        d.items.map((a) => [
          `<a class="link" href="#${prefix}/applications/${a.id}">#${a.number} · ${esc(a.title)}</a>`,
          ...(admin ? [esc(fullname(a.member))] : []),
          esc(labels[a.type]),
          money(a.amount),
          badge(a.status),
          fmt(a.createdAt),
          link(prefix + "/applications/" + a.id, "Көру →", "btn secondary small"),
        ]),
      ) +
      pagination(d),
    prefix + "/applications",
  );
}
async function applicationForm(id) {
  const a = id ? await api("applications/" + id) : {};
  return workspace(
    head(id ? "Өтінішті өңдеу" : "Жаңа өтініш беру", "Мәліметтерді толық әрі нақты енгізіңіз") +
      `<div class="panel form-panel"><form data-form="application" data-id="${id || ""}"><div class="form-grid">${!id ? select("type", "Өтініш түрі", ["MATERIAL", "ONE_TIME", "SOCIAL", "OTHER"], "MATERIAL") : ""}${field("title", "Тақырып", a.title, "text", 'required minlength="3" maxlength="200"')}${!id ? field("amount", "Сома (₸)", "", "number", 'min="0" max="100000000" step="0.01"') : ""}${textarea("description", "Толық мәтін", a.description, 10)}${!id ? uploadField("file", "Қосымша файл (міндетті емес)") : ""}</div><div class="actions"><button class="btn" type="submit">${id ? "Сақтау" : "Өтініш жіберу →"}</button>${link("/applications", "Болдырмау", "btn secondary")}</div></form></div>`,
    "/applications/new",
  );
}
async function applicationDetail(id, admin) {
  const a = await api("applications/" + id);
  return workspace(
    head(
      a.title,
      "Өтініш №" + a.number,
      `<div class="actions">${badge(a.status)}${a.status === "NEW" || isStaff() ? link((admin ? "/admin" : "") + "/applications/" + id + "/edit", "Өңдеу", "btn secondary small") + deleteButton("applications", id) : ""}</div>`,
    ) +
      `<div class="detail-grid"><div><section class="panel"><h2>Өтініш туралы</h2><div class="detail-list"><div><small>Мүше</small><strong>${esc(fullname(a.member))}</strong></div><div><small>Өтініш түрі</small><strong>${esc(labels[a.type])}</strong></div><div><small>Сома</small><strong>${money(a.amount)}</strong></div><div><small>Берілген күні</small><strong>${fmt(a.createdAt)}</strong></div></div><p class="prose">${esc(a.description)}</p>${a.attachments.map((f) => `<a class="attachment" href="${esc(url(f.fileUrl))}" target="_blank" rel="noopener">▥ ${esc(f.fileName)} →</a>`).join("")}<form class="spacer" data-form="attachment" data-id="${id}">${uploadField("file", "Файл қосу")}<button class="btn secondary small">Файлды тіркеу</button></form></section><section class="panel spacer"><h2>Пікірлер мен жауаптар</h2>${a.comments.map((c) => `<div class="comment"><strong>${esc(c.author.name)}</strong> <small>${fmt(c.createdAt)}</small><p>${esc(c.text)}</p></div>`).join("") || '<p class="spacer">Әзірге пікірлер жоқ.</p>'}<form class="spacer" data-form="comment" data-id="${id}">${textarea("text", "Жауап немесе қосымша мәлімет", "", 1)}<button class="btn">Жіберу</button></form></section></div><aside>${isStaff() ? `<section class="panel"><h3>Өтінішті қарау</h3><form class="spacer" data-form="status" data-id="${id}">${select("status", "Статусты өзгерту", ["NEW", "IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED", "COMPLETED"], a.status)}<button class="btn">Сақтау</button></form></section>` : ""}<section class="panel spacer"><h3>Өтініш тарихы</h3><div class="timeline">${a.history.map((h) => `<div class="timeline-item">${badge(h.newStatus)}<p>${esc(h.author.name)}<br>${fmt(h.createdAt)}</p></div>`).join("")}</div></section></aside></div>`,
    admin ? "/admin/applications" : "/applications",
  );
}
async function dashboard(admin) {
  const apps = await api("applications?pageSize=5"),
    events = await api("events?status=UPCOMING&pageSize=3");
  let cards = "";
  if (admin) {
    const stats = await api("statistics");
    cards = statsCards(stats.counts, true);
  } else
    cards = statsCards({
      ...(await api("overview")),
      applications: apps.total,
    });
  let content =
    head(
      "Қош келдіңіз, " + (state.user.member?.firstName || "Әкімші") + "!",
      "Бүгінгі жұмыс пен маңызды мәліметтерге шолу",
      link("/applications/new", "＋ Өтініш беру"),
    ) +
    cards +
    `<section class="panel"><div class="section-head" style="margin-top:0"><h2>Соңғы өтініштер</h2>${link(admin ? "/admin/applications" : "/applications", "Барлығы →", "link")}</div>${table(
      ["Тақырып", "Мүше", "Статус", "Күні"],
      apps.items.map((a) => [
        link((admin ? "/admin" : "") + "/applications/" + a.id, esc(a.title), "link"),
        esc(fullname(a.member)),
        badge(a.status),
        fmt(a.createdAt),
      ]),
    )}</section><section class="panel spacer"><div class="section-head" style="margin-top:0"><h2>Алдағы іс-шаралар</h2>${link("/events", "Барлығы →", "link")}</div>${events.items.map(eventRow).join("") || empty()}</section>`;
  if (admin) {
    const [m, n] = await Promise.all([api("members?pageSize=4"), api("news?pageSize=3")]);
    content += `<div class="lower-grid"><section class="panel"><h2>Жаңа мүшелер</h2>${m.items.map((x) => `<div class="event-row">${person(x)}${badge(x.status)}</div>`).join("")}</section><section class="panel"><h2>Соңғы жаңалықтар</h2>${n.items.map((x) => `<div class="event-row">${link("/news/" + x.slug, esc(x.title), "link")}</div>`).join("")}</section></div>`;
  }
  return workspace(content, admin ? "/admin" : "/cabinet");
}
async function profile() {
  const m = state.user.member || {};
  return workspace(
    head("Менің профилім", "Жеке мәліметтер мен аккаунт қауіпсіздігі") +
      `<div class="detail-grid"><section class="panel"><h2>${esc(fullname(m))}</h2><p>${esc(m.position)} · ${esc(m.department)}</p><div class="spacer">${badge(state.user.role)} ${badge(m.status)}</div><form class="spacer" data-form="profile"><div class="form-grid">${field("firstName", "Аты", m.firstName, "text", 'required maxlength="80"')}${field("lastName", "Тегі", m.lastName, "text", 'required maxlength="80"')}${field("middleName", "Әкесінің аты", m.middleName, "text", 'maxlength="80"')}${field("phone", "Телефон", m.phone, "tel", 'maxlength="30"')}${uploadField("avatarFile", "Профиль суреті", ".jpg,.jpeg,.png")}<input type="hidden" name="avatar" value="${esc(m.avatar || "")}"></div><button class="btn">Сақтау</button></form></section><section class="panel"><h3>Құпиясөзді өзгерту</h3><p class="spacer">${esc(state.user.email)}</p><form class="spacer" data-form="password">${field("currentPassword", "Қазіргі құпиясөз", "", "password", 'required autocomplete="current-password"')}${field("password", "Жаңа құпиясөз", "", "password", 'required minlength="8" maxlength="72" autocomplete="new-password"')}${field("confirmPassword", "Жаңа құпиясөзді қайталау", "", "password", 'required minlength="8" maxlength="72" autocomplete="new-password"')}<button class="btn">Өзгерту</button></form></section></div>`,
    "/profile",
  );
}
function barChart(title, data) {
  const max = Math.max(1, ...data.map((x) => +x.value));
  return `<section class="panel chart"><h3>${title}</h3>${data.length ? `<div class="bars">${data.map((x, i) => `<div><div class="bar-label"><span>${esc(labels[x.label] || x.label)}</span><strong>${x.value}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${(x.value / max) * 100}%;background:${i % 2 ? "var(--gold)" : "var(--green)"}"></div></div></div>`).join("")}</div>` : empty("Осы мерзімде дерек жоқ")}</section>`;
}
function lineChart(title, data) {
  if (!data.length) return barChart(title, data);
  const max = Math.max(1, ...data.map((x) => +x.value)),
    xs = data.map((_, i) => (data.length === 1 ? 210 : 40 + (i * 340) / (data.length - 1))),
    ys = data.map((x) => 145 - (x.value / max) * 110),
    points = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const svg = `<svg viewBox="0 0 420 190" role="img" aria-label="${esc(title)}"><line x1="40" x2="380" y1="145" y2="145" stroke="#dbe5dc"/><line x1="40" x2="380" y1="90" y2="90" stroke="#edf2ed"/><line x1="40" x2="380" y1="35" y2="35" stroke="#edf2ed"/><text x="10" y="149" font-size="10" fill="#606f65">0</text><text x="10" y="39" font-size="10" fill="#606f65">${max}</text><polygon points="${xs[0]},145 ${points} ${xs.at(-1)},145" fill="#e6eee6"/><polyline points="${points}" fill="none" stroke="#153f34" stroke-width="3" stroke-linejoin="round"/>${data.map((x, i) => `<circle cx="${xs[i]}" cy="${ys[i]}" r="5" fill="#b99551"><title>${esc(x.label)}: ${x.value}</title></circle><text x="${xs[i]}" y="172" text-anchor="middle" font-size="10" fill="#606f65">${esc(months[Number(x.label.slice(5)) - 1]?.slice(0, 3) || x.label)}</text>`).join("")}</svg>`;
  return `<section class="panel chart"><h3>${title}</h3>${svg}<div class="chart-legend">${data.map((x) => `<span>${esc(x.label)}: <strong>${x.value}</strong></span>`).join("")}</div></section>`;
}
function donutChart(title, data) {
  if (!data.length) return barChart(title, data);
  const total = data.reduce((n, x) => n + Number(x.value), 0),
    colors = ["#153f34", "#b99551", "#497b67", "#dfc693", "#789386", "#c1d1c5"];
  let offset = 0;
  const circles = data
    .map((x, i) => {
      const length = (x.value / total) * 251.3274;
      const circle = `<circle cx="60" cy="60" r="40" fill="none" stroke="${colors[i % colors.length]}" stroke-width="16" stroke-dasharray="${length} ${251.3274 - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"><title>${esc(labels[x.label] || x.label)}: ${x.value}</title></circle>`;
      offset += length;
      return circle;
    })
    .join("");
  return `<section class="panel chart"><h3>${title}</h3><div class="donut-layout"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(title)}: ${total}">${circles}<text x="60" y="64" text-anchor="middle" font-size="18" font-weight="700" fill="#153f34">${total}</text></svg><div class="donut-legend">${data.map((x, i) => `<div><i style="background:${colors[i % colors.length]}"></i><span>${esc(labels[x.label] || x.label)}</span><strong>${x.value}</strong></div>`).join("")}</div></div></section>`;
}
async function statistics() {
  const days = new URLSearchParams(location.hash.split("?")[1] || "").get("days") || 365,
    s = await api("statistics?days=" + days);
  return workspace(
    head("Статистика", "Дерекқордағы нақты мәліметтер негізінде") +
      filters(
        `<select name="days" aria-label="Мерзім">${[
          [7, "7 күн"],
          [30, "30 күн"],
          [90, "3 ай"],
          [180, "6 ай"],
          [365, "1 жыл"],
        ]
          .map(
            ([v, t]) =>
              `<option value="${v}" ${String(v) === String(days) ? "selected" : ""}>${t}</option>`,
          )
          .join("")}</select>`,
        false,
      ) +
      statsCards(s.counts, true) +
      `<div class="chart-grid">${lineChart("Мүшелердің айлар бойынша өзгеруі", s.charts.members)}${lineChart("Өтініштер динамикасы", s.charts.applications)}${donutChart("Өтініш түрлері", s.charts.type)}${barChart("Өтініш статустары", s.charts.status)}${lineChart("Іс-шаралар динамикасы", s.charts.events)}</div>`,
    "/admin/statistics",
  );
}
async function users() {
  const data = await api("users?" + (location.hash.split("?")[1] || ""));
  return workspace(
    head(
      "Қолданушылар мен рөлдер",
      "Аккаунттардың рөлі, белсенділігі және құпиясөздері",
      link("/admin/members/new", "＋ Қолданушы қосу"),
    ) +
      table(
        ["Қолданушы", "Email", "Рөл", "Белсенділік", "Әрекет"],
        data.items.map((u) => [
          esc(fullname(u.member)),
          esc(u.email),
          badge(u.role),
          badge(u.isActive ? "ACTIVE" : "INACTIVE"),
          link("/admin/users/" + u.id, "Өңдеу", "btn secondary small") +
            " " +
            deleteButton("users", u.id),
        ]),
      ) +
      pagination(data),
    "/admin/users",
  );
}
async function userForm(id) {
  const u = await api("users/" + id);
  if (!u) throw Object.assign(new Error("Қолданушы табылмады"), { status: 404 });
  return workspace(
    head("Қолданушыны басқару", fullname(u.member)) +
      `<div class="panel form-panel"><form data-form="user" data-id="${id}">${field("email", "Email", u.email, "email", "required")}${select("role", "Рөл", ["ADMIN", "CHAIRMAN", "MEMBER"], u.role)}${field("password", "Жаңа құпиясөз (міндетті емес)", "", "password", 'minlength="8" maxlength="72" autocomplete="new-password"')}<label class="check"><input type="checkbox" name="isActive" ${u.isActive ? "checked" : ""}>Белсенді аккаунт</label><button class="btn">Сақтау</button></form></div>`,
    "/admin/users",
  );
}
function settingsPage() {
  const s = state.settings;
  return workspace(
    head("Жүйе баптаулары", "Мектеп пен кәсіподақтың байланыс мәліметтері") +
      `<div class="panel form-panel"><form data-form="settings"><div class="form-grid">${field("schoolName", "Мектеп атауы", s.schoolName, "text", 'required maxlength="200"')}${field("address", "Мекенжай", s.address, "text", 'maxlength="300"')}${field("phone", "Телефон", s.phone, "tel", 'maxlength="60"')}${field("email", "Email", s.email, "email", "required")}${textarea("importantInfo", "Маңызды ақпарат", s.importantInfo)}</div><button class="btn">Сақтау</button></form></div>`,
    "/admin/settings",
  );
}
function errorPage(status, message) {
  return page(
    `<div class="error"><strong>${status || "!"}</strong><h1>${status === 403 ? "Қолжетімділік шектеулі" : status === 404 ? "Бет табылмады" : "Бір қате пайда болды"}</h1><p>${esc(message)}</p><div class="actions" style="justify-content:center">${link("/", "Басты бетке оралу")}<button class="btn secondary" data-action="retry">Қайта көру</button></div></div>`,
  );
}
async function render() {
  const ticket = ++renderId,
    path = (location.hash.slice(1) || "/").split("?")[0],
    p = path.split("/").filter(Boolean);
  root.innerHTML = shell(
    page(
      '<div class="eyebrow">ЖҮКТЕЛУДЕ</div><div class="grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>',
    ),
    path,
  );
  try {
    let html;
    if (!state.installed) html = login(true);
    else if (path === "/") html = await home();
    else if (path === "/login") html = login();
    else {
      const privateRoute = ["admin", "cabinet", "applications", "profile"].includes(p[0]);
      if (privateRoute && !state.user) {
        location.hash = "/login";
        return;
      }
      if (p[0] === "admin" && !isStaff())
        throw Object.assign(new Error("Бұл бөлім әкімшілікке арналған"), {
          status: 403,
        });
      if (p[0] === "admin" && ["users", "settings"].includes(p[1]) && !isAdmin())
        throw Object.assign(new Error("Бұл бөлім тек әкімшіге арналған"), {
          status: 403,
        });
      if (path === "/cabinet" || path === "/admin") html = await dashboard(path === "/admin");
      else if (path === "/profile") html = await profile();
      else if (p[0] === "admin") {
        const resource = p[1],
          id = p[2];
        if (resource === "members")
          html = id ? await memberForm(id === "new" ? null : id) : await memberList();
        else if (resource === "applications")
          html = id
            ? p[3] === "edit"
              ? await applicationForm(id)
              : await applicationDetail(id, true)
            : await applicationList(true);
        else if (["news", "documents", "events"].includes(resource)) {
          if (resource === "documents" && id && !isAdmin())
            throw Object.assign(new Error("Рұқсатыңыз жоқ"), { status: 403 });
          html = id
            ? await contentForm(resource, id === "new" ? null : id)
            : await contentList(resource, true);
        } else if (resource === "statistics") html = await statistics();
        else if (resource === "users") html = id ? await userForm(id) : await users();
        else if (resource === "settings") html = settingsPage();
        else throw Object.assign(new Error("Бет табылмады"), { status: 404 });
      } else if (p[0] === "applications")
        html = p[1]
          ? p[1] === "new"
            ? await applicationForm(null)
            : p[2] === "edit"
              ? await applicationForm(p[1])
              : await applicationDetail(p[1], false)
          : await applicationList(false);
      else if (["news", "documents", "events"].includes(p[0]))
        html = p[1] ? await detail(p[0], p[1]) : await contentList(p[0]);
      else throw Object.assign(new Error("Бет табылмады"), { status: 404 });
    }
    if (ticket === renderId) {
      root.innerHTML = shell(html, path);
      window.scrollTo({ top: 0, behavior: "instant" });
      updateUnread();
    }
  } catch (e) {
    if (ticket !== renderId) return;
    if (e.status === 401) {
      state.user = null;
      location.hash = "/login";
      toast("Сессия аяқталды. Қайта кіріңіз.", true);
    } else root.innerHTML = shell(errorPage(e.status || 500, e.message), path);
  }
}
async function upload(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Файл көлемі 10 МБ-тан аспасын");
  const form = new FormData();
  form.set("file", file);
  return api("uploads", "POST", form);
}
async function updateUnread() {
  if (!state.user) return;
  try {
    const n = await api("notifications"),
      el = document.querySelector("#unread");
    if (el) {
      el.textContent = n.unread;
      el.hidden = !n.unread;
    }
  } catch {}
}
async function notifications() {
  const old = document.querySelector(".notification-menu");
  if (old) {
    old.remove();
    return;
  }
  const n = await api("notifications");
  const el = document.createElement("section");
  el.className = "notification-menu";
  el.setAttribute("aria-label", "Хабарламалар");
  el.innerHTML = `<div class="section-head" style="margin-top:0"><h3>Хабарламалар</h3><button class="btn secondary small" data-action="notifications-close" aria-label="Жабу">×</button></div><button class="link" style="border:0;background:none" data-action="readall">Барлығын оқылды деп белгілеу</button>${n.items.map((x) => `<div class="notification ${x.isRead ? "" : "unseen"}"><a href="${esc(x.link || "#/cabinet")}" data-action="read" data-id="${x.id}"><strong>${esc(x.title)}</strong><p>${esc(x.message)}</p><small>${fmt(x.createdAt)}</small></a></div>`).join("") || empty("Хабарламалар жоқ")}`;
  root.append(el);
  el.querySelector("button").focus();
}
async function confirmDelete() {
  const d = document.querySelector("#confirm");
  d.returnValue = "cancel";
  d.showModal();
  return new Promise((resolve) =>
    d.addEventListener("close", () => resolve(d.returnValue === "yes"), {
      once: true,
    }),
  );
}
document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (!form.matches("[data-form]")) return;
  e.preventDefault();
  if (!form.reportValidity()) return;
  const kind = form.dataset.form,
    fd = new FormData(form),
    b = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
  if (kind === "filters") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(b)) if (v) q.set(k, v);
    location.hash = location.hash.split("?")[0] + (q.size ? "?" + q : "");
    return;
  }
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((x) => (x.disabled = true));
  try {
    let dest = null;
    if (kind === "login") {
      const r = await api("auth/login", "POST", b);
      state.user = r.user;
      state.csrf = r.csrf;
      dest = isStaff() ? "/admin" : "/cabinet";
    } else if (kind === "setup") {
      b.demo = fd.has("demo");
      await api("setup", "POST", b);
      state.installed = true;
      state.settings = (await api("meta")).settings;
      dest = "/login";
    } else if (kind === "member") {
      const photo = fd.get("avatarFile");
      if (photo?.size) b.avatar = (await upload(photo)).fileUrl;
      await api(
        "members" + (form.dataset.id ? "/" + form.dataset.id : ""),
        form.dataset.id ? "PUT" : "POST",
        b,
      );
      dest = "/admin/members";
    } else if (kind === "content") {
      const resource = form.dataset.resource;
      if (resource === "documents") {
        const file = fd.get("file");
        b.fileId = file?.size ? (await upload(file)).id : form.dataset.fileId;
        if (!b.fileId) throw new Error("Құжат файлын таңдаңыз");
      } else {
        const image = fd.get("imageFile");
        if (image?.size) b.image = (await upload(image)).fileUrl;
        if (fd.has("removeImage")) b.image = "";
      }
      b.notify = fd.has("notify");
      delete b.removeImage;
      await api(
        resource + (form.dataset.id ? "/" + form.dataset.id : ""),
        form.dataset.id ? "PUT" : "POST",
        b,
      );
      dest = "/admin/" + resource;
    } else if (kind === "application") {
      const file = fd.get("file");
      if (file?.size) b.fileIds = [(await upload(file)).id];
      await api(
        "applications" + (form.dataset.id ? "/" + form.dataset.id : ""),
        form.dataset.id ? "PUT" : "POST",
        b,
      );
      dest = isStaff() ? "/admin/applications" : "/applications";
    } else if (kind === "comment" || kind === "status") {
      await api(
        "applications/" + form.dataset.id + "/" + (kind === "comment" ? "comments" : "status"),
        "POST",
        b,
      );
    } else if (kind === "attachment") {
      const file = fd.get("file");
      if (!file?.size) throw new Error("Файл таңдаңыз");
      const f = await upload(file);
      await api("applications/" + form.dataset.id + "/attachments", "POST", {
        fileId: f.id,
      });
    } else if (kind === "profile") {
      const file = fd.get("avatarFile");
      if (file?.size) b.avatar = (await upload(file)).fileUrl;
      state.user = await api("auth/profile", "PUT", b);
    } else if (kind === "password") {
      if (b.password !== b.confirmPassword) throw new Error("Құпиясөздер сәйкес емес");
      delete b.confirmPassword;
      await api("auth/password", "PUT", b);
      form.reset();
    } else if (kind === "user") {
      b.isActive = fd.has("isActive");
      await api("users/" + form.dataset.id, "PUT", b);
      state.user = await api("auth/me");
      dest = "/admin/users";
    } else if (kind === "settings") {
      state.settings = await api("settings", "PUT", b);
    }
    toast(kind === "setup" ? "Жүйе орнатылды. Әкімші аккаунтымен кіріңіз." : "Сәтті орындалды");
    if (dest && location.hash !== "#" + dest) location.hash = dest;
    else if (kind !== "password") await render();
  } catch (err) {
    toast(err.message, true);
    const fieldName = err.errors?.[0]?.field;
    if (fieldName) form.elements.namedItem(fieldName)?.focus();
  } finally {
    buttons.forEach((x) => (x.disabled = false));
  }
});
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const action = t.dataset.action;
  try {
    if (action === "menu") {
      const nav = document.querySelector("#nav");
      nav.classList.toggle("open");
      t.setAttribute("aria-expanded", nav.classList.contains("open"));
    } else if (action === "logout") {
      const r = await api("auth/logout", "POST");
      state.user = null;
      state.csrf = r.csrf;
      location.hash = "/";
      await render();
    } else if (action === "notifications") await notifications();
    else if (action === "notifications-close")
      document.querySelector(".notification-menu")?.remove();
    else if (action === "readall") {
      await api("notifications/all/read", "PUT");
      document.querySelector(".notification-menu")?.remove();
      await notifications();
      updateUnread();
    } else if (action === "read") {
      await api("notifications/" + t.dataset.id + "/read", "PUT");
      updateUnread();
    } else if (action === "delete") {
      if (await confirmDelete()) {
        await api(t.dataset.resource + "/" + t.dataset.id, "DELETE");
        toast("Жазба жойылды");
        const path = location.hash.slice(1).split("?")[0],
          destination =
            t.dataset.resource === "applications"
              ? isStaff()
                ? "/admin/applications"
                : "/applications"
              : "/admin/" + t.dataset.resource;
        if (path !== destination) location.hash = destination;
        else await render();
      }
    } else if (action === "join") {
      await api(
        "events/" + t.dataset.id + "/join",
        t.dataset.joined === "true" ? "DELETE" : "POST",
      );
      toast("Қатысу мәліметі жаңартылды");
      await render();
    } else if (action === "page") {
      const [path, query] = location.hash.split("?"),
        q = new URLSearchParams(query || "");
      q.set("page", t.dataset.page);
      location.hash = path + "?" + q;
    } else if (action === "resetfilters") location.hash = location.hash.split("?")[0];
    else if (action === "retry") {
      state = { ...state, ...(await api("meta")) };
      await render();
    }
  } catch (err) {
    toast(err.message, true);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelector(".notification-menu")?.remove();
    document.querySelector("#nav")?.classList.remove("open");
  }
});
window.addEventListener("hashchange", render);
window.setInterval(() => {
  if (!document.hidden) updateUnread();
}, 30000);
try {
  state = { ...state, ...(await api("meta")) };
  await render();
} catch (e) {
  root.innerHTML = errorPage(e.status || 500, e.message);
}
