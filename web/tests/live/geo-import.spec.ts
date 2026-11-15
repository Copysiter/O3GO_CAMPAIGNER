import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { authHeaders, login } from "./session";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tests/fixtures/geo_import");
const expected = JSON.parse(readFileSync(path.join(fixtures, "expected.json"), "utf8"));
const createdByPage = new WeakMap<Page, number[]>();

type ImportSource = { id: string; name: string; row_count: number; sample_rows: string[][] };
type Uploaded = { import_id: string; sources: ImportSource[]; message?: string; format: string };
type Created = {
  import_id: string;
  campaigns: { id: number; name: string; geo: string | null; msg_total: number; status: number }[];
  created_count: number;
};

async function openUpload(page: Page, filename: string): Promise<{ uploaded: Uploaded; name: string }> {
  const name = `E2E-GEO-${filename}-${Date.now()}`;
  await page.getByRole("button", { name: "Новая рассылка", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Название", { exact: false }).fill(name);
  await page.getByLabel("Источник данных", { exact: true }).selectOption("file");
  const input = page.getByLabel("Файл получателей", { exact: true });
  expect(await input.getAttribute("multiple")).toBeNull();
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/upload/" && response.request().method() === "POST");
  await input.setInputFiles(path.join(fixtures, filename));
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  const uploaded = await response.json() as Uploaded;
  expect(uploaded.import_id).toMatch(/^[0-9a-f-]{36}$/i);
  return { uploaded, name };
}

async function next(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Далее", exact: false }).click();
}

async function configureMessage(page: Page, uploaded: Uploaded, {
  header = false, reorderedSecondSheet = false, zip = false, template = expected.template,
}: { header?: boolean; reorderedSecondSheet?: boolean; zip?: boolean; template?: string } = {}) {
  await next(page);
  if (!zip) {
    const headers = page.getByRole("checkbox", { name: /^Первая строка — названия колонок(?: · .+)?$/ });
    if (header) {
      await expect(headers).toHaveCount(uploaded.sources.length);
      for (let index = 0; index < await headers.count(); index++) await headers.nth(index).check();
    }
    for (let index = 0; index < uploaded.sources.length; index++) {
      const suffix = uploaded.sources.length > 1 ? ` · ${uploaded.sources[index].name}` : "";
      const reordered = reorderedSecondSheet && index === 1;
      await page.getByLabel(`Колонка телефона${suffix}`, { exact: true }).selectOption(reordered ? "2" : "0");
      await page.getByLabel(`Колонка поля 1${suffix}`, { exact: true }).selectOption(reordered ? "0" : "1");
      await page.getByLabel(`Колонка поля 2${suffix}`, { exact: true }).selectOption(reordered ? "1" : "2");
    }
    await page.getByLabel("Шаблон сообщения", { exact: false }).fill(template);
  } else if (uploaded.message) {
    await expect(page.getByLabel("Шаблон сообщения", { exact: false })).toHaveValue(uploaded.message);
  } else {
    await page.getByLabel("Шаблон сообщения", { exact: false }).fill(template);
  }
}

async function createImport(page: Page, { split, excludeInvalid = false }: { split: boolean; excludeInvalid?: boolean }) {
  const toggle = page.getByRole("switch", { name: "Разделить по GEO", exact: true });
  await toggle.setChecked(split);
  if (excludeInvalid) {
    await page.getByRole("checkbox", { name: /Пропустить строки с ошибками \(4\)/ }).check();
  }
  const preview = page.getByRole("region", { name: "Предпросмотр создаваемых рассылок", exact: true });
  await expect(preview).toContainText(split ? "[ru]" : "E2E-GEO-");
  if (split) {
    await expect(preview).toContainText("[kz]");
    await expect(preview).toContainText("[in]");
  }
  await next(page);
  await next(page);
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/campaigns/from-import" && response.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: /^Создать(?: \d+)?$/ }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  const data = await response.json() as Created;
  createdByPage.get(page)!.push(...data.campaigns.map((campaign) => campaign.id));
  const body = response.request().postDataJSON();
  expect(body.auto_shorten_links).not.toBe(true);
  expect(body.rewrite).toBeFalsy();
  expect(body.check_dst).toBeFalsy();
  expect(body.clicker_url).toBeFalsy();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Рассылки созданы", exact: true })).toBeVisible();
  expect(data.campaigns).toHaveLength(split ? 3 : 1);
  expect(data.campaigns.reduce((sum, campaign) => sum + campaign.msg_total, 0)).toBe(7);
  for (const campaign of data.campaigns) {
    expect(campaign.status).toBe(0);
    if (split) {
      expect(campaign.name).toMatch(new RegExp(`^\\[${campaign.geo!.toLowerCase()}\\] `));
      expect(campaign.msg_total).toBe(expected.campaign_counts[campaign.geo!]);
    }
  }
  return { data, body };
}

async function recipients(page: Page, data: Created) {
  const headers = await authHeaders(page);
  const result: any[] = [];
  for (const campaign of data.campaigns) {
    const response = await page.request.get(`/api/v1/campaigns/${campaign.id}/campaign_dst?limit=100`, { headers });
    expect(response.ok(), await response.text()).toBeTruthy();
    const payload = await response.json();
    expect(payload.total).toBe(campaign.msg_total);
    result.push(...payload.data);
  }
  expect(result.map((row) => row.dst_addr).sort()).toEqual([...expected.phones].sort());
  expect(result.filter((row) => row.dst_addr === "79991234567")).toHaveLength(2);
  return result;
}

function readWorkbook(filename: string): (string | number | null)[][] {
  // Python's standard library is sufficient; no spreadsheet/npm package install.
  const script = `import json,re,sys,zipfile,xml.etree.ElementTree as ET
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(sys.argv[1]) as z:
 strings=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  strings=[''.join(el.itertext()) for el in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
 rows=[]
 for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:row',ns):
  values=[]
  for cell in row.findall('s:c',ns):
   kind=cell.get('t'); val=cell.find('s:v',ns)
   if kind=='inlineStr': value=''.join(cell.find('s:is',ns).itertext())
   elif val is None: value=None
   elif kind=='s': value=strings[int(val.text)]
   elif kind in ('str','e'): value=val.text
   else:
    try: value=float(val.text); value=int(value) if value.is_integer() else value
    except ValueError: value=val.text
   column=0
   for letter in re.match(r'[A-Z]+',cell.get('r')).group(): column=column*26+ord(letter)-64
   while len(values)<column: values.append(None)
   values[column-1]=value
  rows.append(values)
 print(json.dumps(rows,ensure_ascii=False))`;
  return JSON.parse(execFileSync(process.env.E2E_PYTHON || "python3", ["-c", script, filename], { encoding: "utf8" }));
}

async function downloadAndCheck(page: Page, info: TestInfo, expectedRows: { geo: string; link: string; count: number }[]) {
  const button = page.getByRole("button", { name: "Ссылки по GEO — Excel", exact: true });
  await expect(button).toHaveCount(1);
  const layout = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  expect(layout.page).toBeLessThanOrEqual(layout.viewport);
  const dialogBox = await page.getByRole("dialog").boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(layout.viewport + 1);
  const screenshot = info.outputPath("creation-result.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach("Creation result", { path: screenshot, contentType: "image/png" });
  const downloadPromise = page.waitForEvent("download");
  await button.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const filename = info.outputPath("geo-links.xlsx");
  await download.saveAs(filename);
  expect(await download.failure()).toBeNull();
  await info.attach("GEO report", { path: filename, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const rows = readWorkbook(filename);
  expect(rows[0]).toEqual(["Гео", "Ссылка", "Количество"]);
  const groups = rows.slice(1).filter((row) => !String(row[0]).startsWith("ИТОГО"));
  const canonical = (row: { geo: string; link: string; count: number }) => `${row.geo}|${row.link}|${row.count}`;
  expect(groups.map((row) => canonical({ geo: String(row[0]).split(" ")[0].toUpperCase(), link: String(row[1]), count: Number(row[2]) })).sort())
    .toEqual(expectedRows.map(canonical).sort());
  const total = rows.find((row) => String(row[0]).startsWith("ИТОГО"));
  expect(total?.[2]).toBe(6);
}

test.beforeEach(async ({ page }) => {
  createdByPage.set(page, []);
  await login(page);
});

test.afterEach(async ({ page }) => {
  const ids = createdByPage.get(page) || [];
  if (!ids.length || page.isClosed()) return;
  const headers = await authHeaders(page);
  for (const id of ids) {
    // Only records returned from this test's own successful create request.
    const response = await page.request.delete(`/api/v1/campaigns/${id}`, { headers });
    expect(response.ok(), `Cleanup failed for test campaign ${id}`).toBeTruthy();
  }
});

test("E2E-GEO CSV: split, one report, idempotent creation and independent launch", async ({ page }, info) => {
  const { uploaded } = await openUpload(page, "contacts.csv");
  await configureMessage(page, uploaded, { header: true });
  const { data, body } = await createImport(page, { split: true });
  const rows = await recipients(page, data);
  expect(rows.every((row) => row.text.includes("Здравствуйте,") && !row.text.includes("{field_"))).toBe(true);
  await downloadAndCheck(page, info, expected.tabular_report);
  const headers = await authHeaders(page);
  const repeated = await page.request.post("/api/v1/campaigns/from-import", { headers, data: body });
  expect(repeated.ok(), await repeated.text()).toBeTruthy();
  expect((await repeated.json()).campaigns.map((campaign: { id: number }) => campaign.id).sort())
    .toEqual(data.campaigns.map((campaign) => campaign.id).sort());
  const unauthenticated = await page.request.get(`/api/v1/campaigns/imports/${data.import_id}/geo-links-report`);
  expect([401, 403]).toContain(unauthenticated.status());
  const chosen = data.campaigns.find((campaign) => campaign.geo === "RU")!;
  const before = await page.request.get(`/api/v1/campaigns/${chosen.id}`, { headers });
  const campaign = await before.json();
  expect(campaign.androids).toEqual([]);
  expect(campaign.api_keys).toEqual([]);
  // No devices/API keys and no schedule: toggling status cannot dispatch messages.
  await page.goto(`/campaigns/${chosen.id}`);
  await page.getByRole("button", { name: "Запустить", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("button", { name: "Пауза", exact: true })).toBeVisible();
  for (const item of data.campaigns) {
    const response = await page.request.get(`/api/v1/campaigns/${item.id}`, { headers });
    expect((await response.json()).status).toBe(item.id === chosen.id ? 1 : 0);
  }
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("button", { name: "Запустить", exact: true })).toBeVisible();
});

test("E2E-GEO standalone TXT: extra columns, one mixed campaign and grouped report", async ({ page }, info) => {
  const { uploaded } = await openUpload(page, "contacts-with-fields.txt");
  await configureMessage(page, uploaded);
  const { data } = await createImport(page, { split: false });
  expect(data.campaigns[0].geo).toBeNull();
  const rows = await recipients(page, data);
  expect(rows.find((row) => row.field_1 === "Борис")?.text).toContain("https://example.test/offer/b");
  await downloadAndCheck(page, info, expected.tabular_report);
});

test("E2E-GEO Excel: all sheets and different column orders", async ({ page }, info) => {
  const { uploaded } = await openUpload(page, "contacts-multiple-sheets.xlsx");
  expect(uploaded.sources).toHaveLength(2);
  await configureMessage(page, uploaded, { header: true, reorderedSecondSheet: true });
  const { data } = await createImport(page, { split: true });
  await recipients(page, data);
  await downloadAndCheck(page, info, expected.tabular_report);
});

test("E2E-GEO legacy XLS: async shortening keeps original report links", async ({ page }, info) => {
  const headers = await authHeaders(page);
  const userResponse = await page.request.get("/api/v1/users/me", { headers });
  expect(userResponse.ok()).toBe(true);
  const user = await userResponse.json();
  const needsLocalKey = !user.ext_api_key;
  if (needsLocalKey) {
    // The pre-existing shortener contract requires a user key, even for its local mock.
    const seeded = await page.request.put(`/api/v1/users/${user.id}`, {
      headers, data: { ...user, ext_api_key: "geo-e2e-local-only" },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();
  }
  try {
    const { uploaded } = await openUpload(page, "contacts.xls");
    expect(uploaded.format).toBe("xls");
    await configureMessage(page, uploaded, {
      header: true,
      template: "Здравствуйте, {field_1}! Ваше предложение: [short]{field_2}[/short]",
    });
    const { data } = await createImport(page, { split: true });
    await expect.poll(async () => {
      const allRows = [];
      for (const campaign of data.campaigns) {
        const response = await page.request.get(`/api/v1/campaigns/${campaign.id}/campaign_dst?limit=100`, { headers });
        expect(response.ok(), await response.text()).toBeTruthy();
        allRows.push(...(await response.json()).data);
      }
      return allRows.length === 7 && allRows.every((row) => row.status === 0 &&
        /http:\/\/camp\.o3go\.ru\/[a-f0-9]{6}/.test(row.text) && !row.text.includes("[short]"));
    }, { timeout: 60_000, message: "Local Docker Celery worker should finish shortening every message" }).toBe(true);
    const rows = await recipients(page, data);
    expect(rows.every((row) => row.link === row.field_2 && row.link.startsWith("https://example.test/offer/"))).toBe(true);
    expect(rows.every((row) => !row.text.includes(row.link))).toBe(true);
    await downloadAndCheck(page, info, expected.tabular_report);
  } finally {
    if (needsLocalKey) {
      const restored = await page.request.put(`/api/v1/users/${user.id}`, { headers, data: user });
      expect(restored.ok(), await restored.text()).toBeTruthy();
    }
  }
});

test("E2E-GEO ZIP: merge phone lists, keep shared multiline text and first link", async ({ page }, info) => {
  const { uploaded } = await openUpload(page, "campaign.zip");
  expect(uploaded.sources).toHaveLength(1);
  await configureMessage(page, uploaded, { zip: true });
  const { data } = await createImport(page, { split: true });
  const rows = await recipients(page, data);
  expect(rows.every((row) => row.text === uploaded.message)).toBe(true);
  expect(rows.every((row) => row.link === "https://example.test/offer/a")).toBe(true);
  await downloadAndCheck(page, info, expected.zip_report);
});

test("E2E-GEO ZIP: invalid lines require explicit exclusion", async ({ page }, info) => {
  const { uploaded } = await openUpload(page, "campaign-invalid-lines.zip");
  await configureMessage(page, uploaded, { zip: true });
  await expect(page.getByText(/ignored\.csv/).first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Пропустить строки с ошибками \(4\)/ })).toBeVisible();
  await next(page);
  await expect(page.getByRole("alert")).toContainText("Исправьте номера или разрешите пропустить строки с ошибками");
  const { data } = await createImport(page, { split: true, excludeInvalid: true });
  await recipients(page, data);
  await downloadAndCheck(page, info, expected.zip_report);
});

test("E2E-GEO corrupt ZIP: error is visible and creation is not submitted", async ({ page }) => {
  await page.getByRole("button", { name: "Новая рассылка", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Название", { exact: false }).fill(`E2E-GEO-corrupt-${Date.now()}`);
  await page.getByLabel("Источник данных", { exact: true }).selectOption("file");
  const creationRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/campaigns/")) creationRequests.push(request.url());
  });
  const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/upload/");
  await page.getByLabel("Файл получателей", { exact: true }).setInputFiles(path.join(fixtures, "corrupt.zip"));
  const response = await responsePromise;
  expect(response.ok()).toBe(false);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(creationRequests).toEqual([]);
});
