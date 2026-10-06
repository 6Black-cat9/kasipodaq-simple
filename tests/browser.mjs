import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright");
const project = fileURLToPath(new URL("../", import.meta.url));
const shots = process.env.SHOT_DIR || path.join(project, "tests/artifacts");
await mkdir(shots, { recursive: true });
import assert from "node:assert/strict";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.TEST_URL || "http://127.0.0.1:4080/";
async function route(hash, text) {
  await page.goto(base + "#" + hash);
  await page.getByRole("heading", { name: text, exact: true }).waitFor();
}
await route("/", /Кәсіподақ —/);
await page.evaluate(() => document.querySelector("#toasts").replaceChildren());
await page.screenshot({
  path: path.join(shots, "kasipodaq-simple-desktop.png"),
  fullPage: true,
});
for (const [hash, text] of [
  ["/news", "Жаңалықтар"],
  ["/documents", "Құжаттар"],
  ["/events", "Іс-шаралар"],
])
  await route(hash, text);
await route("/login", "Жүйеге кіру");
await page.getByLabel("Email", { exact: true }).fill("member@example.com");
await page.getByLabel("Құпиясөз", { exact: true }).fill("Dev@12345!");
await page.getByRole("button", { name: "Кіру →", exact: true }).click();
await page.getByRole("heading", { name: "Қош келдіңіз, Ерлан!" }).waitFor();
await route("/applications/new", "Жаңа өтініш беру");
await page.getByLabel("Тақырып", { exact: true }).fill("Браузердегі тест өтініші");
await page.getByLabel("Сома (₸)").fill("25000");
await page
  .getByLabel("Толық мәтін")
  .fill("Материалдық көмек көрсетуіңізді сұраймын. Құжаттар қоса тіркеледі.");
await page
  .getByLabel("Қосымша файл")
  .setInputFiles(path.join(project, "seed-documents/seed-document-1.pdf"));
await page.getByRole("button", { name: "Өтініш жіберу →" }).click();
await page.getByRole("heading", { name: "Менің өтініштерім", exact: true }).waitFor();
await page.getByRole("link", { name: /Браузердегі тест өтініші/ }).click();
await page.getByRole("heading", { name: "Браузердегі тест өтініші", exact: true }).waitFor();
const applicationHash = new URL(page.url()).hash;
await page.getByLabel("Жауап немесе қосымша мәлімет").fill("Қосымша мәлімет беруге дайынмын.");
await page.getByRole("button", { name: "Жіберу", exact: true }).click();
await page.getByText("Қосымша мәлімет беруге дайынмын.", { exact: true }).waitFor();
await route("/admin", "Қолжетімділік шектеулі");
await page.getByRole("button", { name: "Шығу", exact: true }).click();
await page.getByRole("heading", { name: /Кәсіподақ —/ }).waitFor();
await route("/login", "Жүйеге кіру");
await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
await page.getByLabel("Құпиясөз", { exact: true }).fill("Dev@12345!");
await page.getByRole("button", { name: "Кіру →", exact: true }).click();
await page.getByRole("heading", { name: "Қош келдіңіз, Әкімші!" }).waitFor();
await page.evaluate(() => document.querySelector("#toasts").replaceChildren());
await page.screenshot({
  path: path.join(shots, "kasipodaq-simple-admin.png"),
  fullPage: true,
});
for (const [hash, text] of [
  ["/admin/members", "Кәсіподақ мүшелері"],
  ["/admin/applications", "Өтініштер"],
  ["/admin/news", "Жаңалықтар"],
  ["/admin/documents", "Құжаттар"],
  ["/admin/events", "Іс-шаралар"],
  ["/admin/statistics", "Статистика"],
  ["/admin/users", "Қолданушылар мен рөлдер"],
  ["/admin/settings", "Жүйе баптаулары"],
  ["/profile", "Менің профилім"],
])
  await route(hash, text);
await page.goto(base + applicationHash.replace("#/applications/", "#/admin/applications/"));
await page.getByRole("heading", { name: "Браузердегі тест өтініші", exact: true }).waitFor();
await page.getByLabel("Статусты өзгерту").selectOption("APPROVED");
await page
  .locator('form[data-form="status"]')
  .getByRole("button", { name: "Сақтау", exact: true })
  .click();
await page.locator(".timeline").getByText("Мақұлданды", { exact: true }).waitFor();
await page.getByRole("button", { name: "Жою", exact: true }).click();
await page.getByRole("dialog").getByRole("button", { name: "Жою", exact: true }).click();
await page.getByRole("heading", { name: "Өтініштер", exact: true }).waitFor();
await route("/admin/news/new", "Қосу: жаңалық");
await page.getByLabel("Тақырып", { exact: true }).fill("Браузердегі жаңалық");
await page.getByLabel("Сілтеме (slug)").fill("browser-news");
await page.getByLabel("Қысқаша сипаттама").fill("Жаңалықтың қысқа сипаттамасы");
await page.getByLabel("Толық мәтін").fill("Браузер арқылы жаңалықты қосу және басқару тексерілді.");
await page.getByLabel("Статус", { exact: true }).selectOption("PUBLISHED");
await page
  .getByLabel("Мұқаба суреті")
  .setInputFiles(path.join(project, "public/assets/images/news-1.jpg"));
await page.getByRole("button", { name: "Сақтау", exact: true }).click();
await page.getByRole("heading", { name: "Жаңалықтар", exact: true }).waitFor();
const row = page.getByRole("row").filter({ hasText: "Браузердегі жаңалық" });
await row.getByRole("link", { name: "Өңдеу", exact: true }).click();
await page.getByLabel("Тақырып", { exact: true }).fill("Браузердегі өңделген жаңалық");
await page.getByRole("button", { name: "Сақтау", exact: true }).click();
await page.getByRole("row").filter({ hasText: "Браузердегі өңделген жаңалық" }).waitFor();
await page
  .getByRole("row")
  .filter({ hasText: "Браузердегі өңделген жаңалық" })
  .getByRole("button", { name: "Жою", exact: true })
  .click();
await page.getByRole("dialog").getByRole("button", { name: "Жою", exact: true }).click();
await page
  .getByText("Браузердегі өңделген жаңалық", { exact: true })
  .waitFor({ state: "detached" });
await page.setViewportSize({ width: 390, height: 844 });
await route("/", /Кәсіподақ —/);
await page.evaluate(() => document.querySelector("#toasts").replaceChildren());
await page.screenshot({
  path: path.join(shots, "kasipodaq-simple-mobile.png"),
  fullPage: true,
});
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "Mobile page overflows",
);
await page.getByRole("button", { name: "Мәзірді ашу" }).click();
await page.locator("#nav").getByRole("link", { name: "Мүшелер", exact: true }).click();
await page.getByRole("heading", { name: "Кәсіподақ мүшелері", exact: true }).waitFor();
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "Mobile table overflows",
);
await page.evaluate(() => document.querySelector("#toasts").replaceChildren());
await page.screenshot({
  path: path.join(shots, "kasipodaq-simple-members-mobile.png"),
  fullPage: true,
});
assert.deepEqual(errors, []);
console.log(
  "Browser: public pages, member application/file/comment, admin status/delete, news upload/edit/delete, mobile navigation and overflow passed.",
);
await browser.close();
