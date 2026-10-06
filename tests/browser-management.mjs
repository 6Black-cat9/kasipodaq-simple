import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
const project = fileURLToPath(new URL("../", import.meta.url)),
  base = process.env.TEST_URL || "http://127.0.0.1:4080/";
page.on("pageerror", (e) => errors.push(e.message));
async function route(hash, title) {
  await page.goto(base + "#" + hash);
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
}
async function save() {
  await page.getByRole("button", { name: "Сақтау", exact: true }).click();
}
async function removeRow(title) {
  const row = page.getByRole("row").filter({ hasText: title });
  await row.getByRole("button", { name: "Жою", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Жою", exact: true }).click();
  await row.waitFor({ state: "detached" });
}
await route("/login", "Жүйеге кіру");
await page.getByLabel("Email", { exact: true }).fill("admin@example.com");
await page.getByLabel("Құпиясөз", { exact: true }).fill("Dev@12345!");
await page.getByRole("button", { name: "Кіру →", exact: true }).click();
await page.getByRole("heading", { name: "Қош келдіңіз, Әкімші!" }).waitFor();
await route("/admin/members/new", "Жаңа мүше");
await page.getByLabel("Аты", { exact: true }).fill("Тест");
await page.getByLabel("Тегі", { exact: true }).fill("Браузер");
await page.getByLabel("Қызметі", { exact: true }).fill("Мұғалім");
await page.getByLabel("Бөлімі", { exact: true }).fill("Қазақ тілі");
await page.getByLabel("Email", { exact: true }).fill("browser@example.com");
await page.getByLabel("Құпиясөз", { exact: true }).fill("Browser123!");
await page
  .getByLabel("Мүше суреті")
  .setInputFiles(path.join(project, "public/assets/images/news-1.jpg"));
await save();
await page.getByRole("heading", { name: "Кәсіподақ мүшелері", exact: true }).waitFor();
await page
  .getByRole("row")
  .filter({ hasText: "browser@example.com" })
  .getByRole("link", { name: "Өңдеу", exact: true })
  .click();
await page.getByLabel("Аты", { exact: true }).fill("Тестөзгеріс");
await save();
await page.getByRole("heading", { name: "Кәсіподақ мүшелері", exact: true }).waitFor();
await page.getByRole("row").filter({ hasText: "Тестөзгеріс" }).waitFor();
const memberPage = await browser.newPage();
await memberPage.goto(base + "#/login");
await memberPage.getByLabel("Email", { exact: true }).fill("browser@example.com");
await memberPage.getByLabel("Құпиясөз", { exact: true }).fill("Browser123!");
await memberPage.getByRole("button", { name: "Кіру →", exact: true }).click();
await memberPage.getByRole("heading", { name: "Қош келдіңіз, Тестөзгеріс!" }).waitFor();
assert.equal(
  await memberPage
    .locator('a[aria-label="Профиль"] img')
    .evaluate((img) => img.complete && img.naturalWidth > 0),
  true,
);
await memberPage.goto(base + "#/profile");
await memberPage.getByRole("heading", { name: "Менің профилім" }).waitFor();
await memberPage.getByLabel("Телефон", { exact: true }).fill("+7 700 111 22 33");
await memberPage
  .locator('form[data-form="profile"]')
  .getByRole("button", { name: "Сақтау" })
  .click();
await memberPage.getByText("Сәтті орындалды", { exact: true }).waitFor();
await memberPage.close();
await route("/admin/users", "Қолданушылар мен рөлдер");
await page
  .getByRole("row")
  .filter({ hasText: "browser@example.com" })
  .getByRole("link", { name: "Өңдеу", exact: true })
  .click();
await page.getByLabel("Рөл", { exact: true }).selectOption("CHAIRMAN");
await save();
await page.getByRole("heading", { name: "Қолданушылар мен рөлдер", exact: true }).waitFor();
await page
  .getByRole("row")
  .filter({ hasText: "browser@example.com" })
  .getByText("Төраға", { exact: true })
  .waitFor();
await route("/admin/documents/new", "Қосу: құжат");
await page.getByLabel("Тақырып", { exact: true }).fill("Браузердің тест құжаты");
await page.getByLabel("Сипаттама", { exact: true }).fill("Құжат жүктеу сынағы");
await page
  .getByLabel("Құжат файлы")
  .setInputFiles(path.join(project, "seed-documents/seed-document-1.pdf"));
await save();
await page.getByRole("heading", { name: "Құжаттар", exact: true }).waitFor();
await page
  .getByRole("row")
  .filter({ hasText: "Браузердің тест құжаты" })
  .getByRole("link", { name: "Өңдеу", exact: true })
  .click();
await page.getByLabel("Тақырып", { exact: true }).fill("Браузердің өңделген құжаты");
await save();
await page.getByRole("heading", { name: "Құжаттар", exact: true }).waitFor();
await removeRow("Браузердің өңделген құжаты");
await route("/admin/events/new", "Қосу: іс-шара");
await page.getByLabel("Тақырып", { exact: true }).fill("Браузердің тест іс-шарасы");
await page.getByLabel("Сипаттама", { exact: true }).fill("Браузердегі толық іс-шара сынағы");
await page.getByLabel("Күні", { exact: true }).fill("2099-01-01");
await page.getByLabel("Өтетін орны", { exact: true }).fill("Мектеп залы");
await save();
await page.getByRole("heading", { name: "Іс-шаралар", exact: true }).waitFor();
await page
  .getByRole("row")
  .filter({ hasText: "Браузердің тест іс-шарасы" })
  .getByRole("link", { name: "Өңдеу", exact: true })
  .click();
await page.getByLabel("Тақырып", { exact: true }).fill("Браузердің өңделген іс-шарасы");
await save();
await page.getByRole("heading", { name: "Іс-шаралар", exact: true }).waitFor();
await removeRow("Браузердің өңделген іс-шарасы");
await route("/admin/settings", "Жүйе баптаулары");
await page.getByLabel("Мектеп атауы", { exact: true }).fill("Тексерілген мектеп");
await save();
await page.waitForFunction(()=>document.querySelector("#f-schoolName")?.defaultValue==="Тексерілген мектеп");
await page.getByLabel("Мектеп атауы", { exact: true }).fill("№25 жалпы білім беретін мектеп");
await save();
await page.waitForFunction(()=>document.querySelector("#f-schoolName")?.defaultValue==="№25 жалпы білім беретін мектеп");
await route("/admin/members", "Кәсіподақ мүшелері");
await removeRow("browser@example.com");
await route("/admin/statistics", "Статистика");
await page.getByLabel("Мерзім").selectOption("7");
const filterResponse = page.waitForResponse(
  (r) => r.url().includes("path=statistics") && r.url().includes("days=7"),
);
await page.getByRole("button", { name: "Қолдану", exact: true }).click();
await filterResponse;
await page.getByRole("heading", { name: "Статистика", exact: true }).waitFor();
await page.locator(".chart").last().waitFor();
assert.equal(await page.locator(".chart").count(), 5);
await page.getByRole("button", { name: "Хабарламалар", exact: true }).click();
await page.getByRole("heading", { name: "Хабарламалар", exact: true }).waitFor();
await page.getByRole("button", { name: "Барлығын оқылды деп белгілеу", exact: true }).click();
await page.locator("#unread").waitFor({ state: "hidden" });
assert.deepEqual(errors, []);
console.log(
  "Browser management: member photo/create/edit/delete, member profile save, user role, documents upload/edit/delete, events CRUD, settings, statistics and notifications passed.",
);
await browser.close();
