import { expect, test, type Page, type Route } from "@playwright/test";

type CapturedRequest = {
  method: string;
  path: string;
  body: any;
  contentType: string;
  authorization: string;
};
const account = {
  id: 7,
  name: "Campaign contract test",
  login: "campaign-test",
  is_active: true,
  is_superuser: true,
  permissions: [] as string[],
};
const existing = {
  id: 91,
  name: "Contract fixture",
  user_id: 7,
  user: account,
  status: 0,
  api_keys: ["key-existing"],
  androids: ["device-existing"],
  tags: [{ id: 3, name: "Existing" }],
  msg_template: "Привет, {field_1}",
  msg_attempts: 1,
  order: 1,
  msg_sending_timeout: 3600,
  msg_status_timeout: 86400,
  follow_limit: 0,
  msg_total: 2,
  msg_sent: 0,
  msg_delivered: 0,
  msg_undelivered: 0,
  msg_failed: 0,
  schedule: { 1: [9], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
  start_ts: "2026-11-03 09:30:00",
  stop_ts: "2026-11-04 10:30:00",
};

async function setup(
  page: Page,
  { admin = true, uploadError = false, language = "ru" } = {},
) {
  let stored = { ...existing };
  await page.addInitScript((language) => {
    localStorage.setItem(
      "campaigner.preferences",
      JSON.stringify({
        version: 2,
        theme: "dark",
        accent: "green",
        language,
        tableMode: "auto",
      }),
    );
  }, language);
  const user = {
    ...account,
    is_superuser: admin,
    permissions: admin ? [] : ["campaign.read", "campaign.manage"],
  };
  const requests: CapturedRequest[] = [];
  await page.addInitScript((user) => {
    localStorage.setItem(
      "campaigner.workspace.session",
      JSON.stringify({
        access_token: "campaign-fixture",
        token_type: "bearer",
        user,
        ts: "2026-11-02T00:00:00",
      }),
    );
  }, user);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    let body: any;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    requests.push({
      method: request.method(),
      path,
      body,
      contentType: request.headers()["content-type"] || "",
      authorization: request.headers()["authorization"] || "",
    });
    let result: any = {};
    if (path === "/auth/test-token")
      result = { user, ts: "2026-11-02T00:00:00" };
    else if (path === "/upload/")
      result = uploadError
        ? { type: "ParserError", msg: "Не удалось разобрать CSV" }
        : {
            filename: "uploaded-fixture.csv",
            fields: ["Иван", "79990000001", "https://example.com/promo"],
          };
    else if (path === "/options/user") result = [{ value: 7, text: user.name }];
    else if (path === "/options/api_key")
      result = [{ value: "key-existing", text: "Existing key" }];
    else if (path === "/options/android")
      result = [{ value: "device-existing", text: "Existing device" }];
    else if (path === "/options/tag") result = [{ value: 3, text: "Existing" }];
    else if (path === "/campaigns/" && request.method() === "GET")
      result = { data: [stored], total: 1 };
    else if (path === "/campaigns/" && request.method() === "POST")
      result = { ...existing, ...body, id: 92 };
    else if (path === "/campaigns/91") {
      if (request.method() === "PUT") stored = { ...stored, ...body };
      result = stored;
    } else if (path === "/campaigns/91/campaign_dst")
      result = { data: [], total: 0 };
    else if (path.startsWith("/options/")) result = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  return requests;
}

async function openForm(page: Page, name: string) {
  await page.goto("/campaigns");
  await page
    .getByRole("button", { name: "Новая кампания", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Название", { exact: false })
    .fill(name);
}
async function openCampaignSettings(page: Page) {
  if ((page.viewportSize()?.width || 0) >= 768) {
    await page.getByRole("button", { name: "Настройки", exact: true }).click();
  } else {
    await page
      .getByRole("button", { name: "Все действия кампании", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Настройки кампании", exact: true })
      .click();
  }
}
async function next(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Далее", exact: false })
    .click();
}
async function create(page: Page) {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Создать кампанию", exact: false })
    .click();
}

// These tests intercept the API and verify the exact contract used by the existing Python backend.
test("uploaded CSV previews real columns and sends mapped indexes with an unchanged UTC schedule", async ({
  page,
}) => {
  const requests = await setup(page);
  await openForm(page, "Uploaded contract");
  await page
    .getByLabel("Источник данных", { exact: true })
    .selectOption("file");
  await page.getByLabel("Файл получателей", { exact: true }).setInputFiles({
    name: "audience.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Иван;79990000001;https://example.com/promo"),
  });
  await expect(
    page.getByText("audience.csv · 3 колонок", { exact: true }),
  ).toBeVisible();
  const upload = requests.find((request) => request.path === "/upload/")!;
  expect(upload.method).toBe("POST");
  expect(upload.contentType).toContain("multipart/form-data; boundary=");
  expect(upload.body).toContain('name="file"; filename="audience.csv"');
  expect(upload.authorization).toBe("bearer campaign-fixture");
  await next(page);
  await expect(page.getByRole("dialog").getByRole("table")).toContainText(
    "Иван",
  );
  await page.getByLabel("Колонка телефона", { exact: true }).selectOption("1");
  await page.getByLabel("Колонка поля 1", { exact: true }).selectOption("0");
  await page.getByLabel("Колонка поля 2", { exact: true }).selectOption("2");
  await page
    .getByLabel("Шаблон сообщения", { exact: false })
    .fill("Привет, {field_1}! {field_2}");
  await expect(
    page.getByText("Привет, Иван! https://example.com/promo", { exact: true }),
  ).toBeVisible();
  await next(page);
  await page
    .getByLabel("Начало (UTC)", { exact: true })
    .fill("2026-11-03T09:30");
  await page
    .getByLabel("Завершение (UTC)", { exact: true })
    .fill("2026-11-04T10:45");
  await page
    .getByRole("button", { name: "Вторник, 13:00 UTC", exact: true })
    .click();
  await next(page);
  await create(page);
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.method === "POST" && request.path === "/campaigns/",
      ),
    )
    .toBe(true);
  const payload = requests.find(
    (request) => request.method === "POST" && request.path === "/campaigns/",
  )!.body;
  expect(payload).toMatchObject({
    name: "Uploaded contract",
    status: 0,
    data_file_name: "uploaded-fixture.csv",
    start_ts: "2026-11-03T09:30:00",
    stop_ts: "2026-11-04T10:45:00",
  });
  expect(payload).not.toHaveProperty("data_text");
  expect(payload.data_fields).toEqual({
    dst_addr: 1,
    field_1: 0,
    field_2: 2,
    field_3: null,
    field_4: null,
    field_5: null,
  });
  expect(payload.schedule).toEqual({
    1: [],
    2: [13],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  });
  expect(requests.some((request) => request.path.endsWith("/start"))).toBe(
    false,
  );
});

test("text header removal is performed locally and unauthorized relation fields are omitted", async ({
  page,
}) => {
  const requests = await setup(page, { admin: false });
  await openForm(page, "Text permissions contract");
  await expect(page.getByLabel("Владелец", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Данные получателей", { exact: true })
    .fill("Телефон;Имя\r\n79990000001;Иван\r\n\r\n79990000002;Анна\r\n");
  await page.getByLabel("Пропустить строк", { exact: true }).fill("1");
  await expect(
    page.getByText("Получателей: 2. Пустые строки пропускаются.", {
      exact: true,
    }),
  ).toBeVisible();
  await next(page);
  await page.getByRole("button", { name: "По порядку", exact: true }).click();
  await page
    .getByLabel("Шаблон сообщения", { exact: false })
    .fill("Здравствуйте, {field_1}");
  await expect(
    page.getByText("Здравствуйте, Иван", { exact: true }),
  ).toBeVisible();
  await next(page);
  await page
    .getByRole("button", { name: "Воскресенье, 09:00 UTC", exact: true })
    .click();
  await next(page);
  await create(page);
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.method === "POST" && request.path === "/campaigns/",
      ),
    )
    .toBe(true);
  const payload = requests.find(
    (request) => request.method === "POST" && request.path === "/campaigns/",
  )!.body;
  expect(payload.data_text).toBe("79990000001;Иван\n79990000002;Анна");
  expect(payload.data_text_row_skip).toBe(0);
  expect(payload.data_text_row_sep).toBe("\n");
  expect(payload.data_fields).toEqual({
    dst_addr: 0,
    field_1: 1,
    field_2: null,
    field_3: null,
    field_4: null,
    field_5: null,
  });
  expect(payload.schedule["7"]).toEqual([9]);
  for (const key of [
    "user_id",
    "api_keys",
    "androids",
    "tags",
    "auto_shorten_links",
    "model",
  ])
    expect(payload).not.toHaveProperty(key);
  expect(
    requests.some((request) =>
      [
        "/options/user",
        "/options/api_key",
        "/options/android",
        "/options/tag",
        "/options/openrouter/models",
      ].includes(request.path),
    ),
  ).toBe(false);
});

test("HTTP 200 parser errors prevent creation and preserve the editable audience step", async ({
  page,
}) => {
  const requests = await setup(page, { uploadError: true });
  await openForm(page, "Broken upload");
  await page
    .getByLabel("Источник данных", { exact: true })
    .selectOption("file");
  await page.getByLabel("Файл получателей", { exact: true }).setInputFiles({
    name: "broken.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Не удалось разобрать CSV",
  );
  await next(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Выберите файл и дождитесь его загрузки",
  );
  await expect(
    page.getByRole("button", { name: "Выбрать файл", exact: true }),
  ).toBeVisible();
  expect(
    requests.some(
      (request) => request.method === "POST" && request.path === "/campaigns/",
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("canceling a pending upload aborts the request without creating a campaign", async ({
  page,
}) => {
  const requests = await setup(page);
  const uploads: Route[] = [];
  const aborted: string[] = [];
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/upload/")
      aborted.push(request.failure()?.errorText || "failed");
  });
  await page.route("**/api/v1/upload/", (route) => {
    uploads.push(route);
  });
  await openForm(page, "Canceled upload");
  await page
    .getByLabel("Источник данных", { exact: true })
    .selectOption("file");
  await page.getByLabel("Файл получателей", { exact: true }).setInputFiles({
    name: "pending.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("79990000001;Иван"),
  });
  await expect.poll(() => uploads.length).toBe(1);
  await expect(
    page.getByText("Загрузка и чтение колонок…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => aborted.length).toBe(1);
  await uploads[0].abort().catch(() => {});
  expect(
    requests.some(
      (request) => request.method === "POST" && request.path === "/campaigns/",
    ),
  ).toBe(false);
});

test("wizard validation prevents empty recipients, zero attempts and reversed dates", async ({
  page,
}) => {
  const requests = await setup(page);
  await openForm(page, "Validation fixture");
  await page.getByLabel("Данные получателей", { exact: true }).fill(";Иван");
  await next(page);
  await page
    .getByLabel("Шаблон сообщения", { exact: false })
    .fill("Тестовое сообщение");
  await next(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "отсутствует телефон",
  );
  await page.getByRole("button", { name: "Назад", exact: false }).click();
  await page
    .getByLabel("Данные получателей", { exact: true })
    .fill("79990000001;Иван");
  await next(page);
  await page
    .getByLabel("Шаблон сообщения", { exact: false })
    .fill("Тестовое сообщение");
  await next(page);
  await page.getByLabel("Попытки отправки", { exact: true }).fill("0");
  await next(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "не меньше 1",
  );
  await page.getByLabel("Попытки отправки", { exact: true }).fill("2");
  await page
    .getByLabel("Начало (UTC)", { exact: true })
    .fill("2026-11-04T10:00");
  await page
    .getByLabel("Завершение (UTC)", { exact: true })
    .fill("2026-11-03T10:00");
  await next(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Дата завершения должна быть позже даты начала",
  );
  expect(
    requests.some(
      (request) => request.method === "POST" && request.path === "/campaigns/",
    ),
  ).toBe(false);
});

test("editing preserves hidden associations and normalizes backend date strings without a timezone shift", async ({
  page,
}) => {
  const requests = await setup(page, { admin: false });
  await page.goto("/campaigns/91");
  await openCampaignSettings(page);
  await page
    .getByRole("dialog")
    .getByLabel("Название", { exact: false })
    .fill("Updated contract");
  await expect(page.getByLabel("Начало (UTC)", { exact: true })).toHaveValue(
    "2026-11-03T09:30",
  );
  await expect(
    page.getByLabel("Завершение (UTC)", { exact: true }),
  ).toHaveValue("2026-11-04T10:30");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.method === "PUT" && request.path === "/campaigns/91",
      ),
    )
    .toBe(true);
  const payload = requests.find(
    (request) => request.method === "PUT" && request.path === "/campaigns/91",
  )!.body;
  expect(payload.name).toBe("Updated contract");
  expect(payload.start_ts).toBe("2026-11-03T09:30:00");
  expect(payload.schedule).toEqual(existing.schedule);
  for (const key of [
    "status",
    "user_id",
    "api_keys",
    "androids",
    "tags",
    "data_fields",
    "data_text",
  ])
    expect(payload).not.toHaveProperty(key);
});

async function openSchedule(page: Page, title: string) {
  await openForm(page, title);
  await page
    .getByLabel("Данные получателей", { exact: true })
    .fill("79990000001;Иван");
  await next(page);
  await page
    .getByLabel("Шаблон сообщения", { exact: false })
    .fill("Сообщение по расписанию");
  await next(page);
  await expect(page.getByRole("dialog").locator(".scheduler-hour")).toHaveCount(
    168,
  );
}
async function createdSchedule(page: Page, requests: CapturedRequest[]) {
  await next(page);
  await create(page);
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.method === "POST" && request.path === "/campaigns/",
      ),
    )
    .toBe(true);
  return requests.find(
    (request) => request.method === "POST" && request.path === "/campaigns/",
  )!.body.schedule;
}

test("original scheduler toggles weekday, whole-week hour and AM/PM headers with the exact backend shape", async ({
  page,
}) => {
  const requests = await setup(page);
  await openSchedule(page, "Original header contract");
  const grid = page.getByRole("dialog").locator(".scheduler");
  await expect(grid.locator("tbody tr")).toHaveCount(7);
  const runtime = await page.evaluate(async () => {
    const host = window as any;
    const $ = await host.__o3goSchedulerRuntime;
    return {
      jqueryGlobal: typeof host.jQuery,
      dollarGlobal: typeof host.$,
      serialized: $.fn.scheduler.util.serialize({ 1: [9] }),
    };
  });
  expect(runtime.jqueryGlobal).toBe("undefined");
  expect(runtime.dollarGlobal).toBe("undefined");
  expect(runtime.serialized).toHaveLength(168);
  expect(runtime.serialized[9]).toBe("1");
  expect(runtime.serialized.replace(/0/g, "")).toBe("1");
  await page
    .getByRole("button", { name: "Весь день: Понедельник", exact: true })
    .click();
  await expect(grid.locator(".scheduler-active")).toHaveCount(24);
  await page
    .getByRole("button", { name: "Вся неделя: 5:00 UTC", exact: true })
    .click();
  await expect(grid.locator(".scheduler-active")).toHaveCount(30);
  await page.getByRole("button", { name: "AM · 00–11", exact: true }).click();
  await expect(grid.locator(".scheduler-active")).toHaveCount(96);
  await page.getByRole("button", { name: "PM · 12–23", exact: true }).click();
  await expect(grid.locator(".scheduler-active")).toHaveCount(168);
  await page.getByRole("button", { name: "PM · 12–23", exact: true }).click();
  await expect(grid.locator(".scheduler-active")).toHaveCount(84);
  await page.getByRole("button", { name: "Очистить", exact: true }).click();
  await expect(grid.locator(".scheduler-active")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Весь день: Среда", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Вся неделя: 15:00 UTC", exact: true })
    .click();
  const payload = await createdSchedule(page, requests);
  const expected = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [
      String(index + 1),
      index === 2 ? Array.from({ length: 24 }, (_, hour) => hour) : [15],
    ]),
  );
  expect(payload).toEqual(expected);
});

test("original mouse drag selects a rectangular range across several days", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Native mouse range is verified in the desktop project; touch has a separate adapter test.",
  );
  const requests = await setup(page);
  await openSchedule(page, "Original range contract");
  const grid = page.getByRole("dialog").locator(".scheduler");
  const start = grid.locator('.scheduler-hour[data-row="2"][data-col="11"]');
  const end = grid.locator('.scheduler-hour[data-row="4"][data-col="13"]');
  await end.scrollIntoViewIfNeeded();
  const a = (await start.boundingBox())!,
    b = (await end.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(grid.locator(".scheduler-active")).toHaveCount(9);
  const payload = await createdSchedule(page, requests);
  expect(payload).toEqual({
    1: [],
    2: [11, 12, 13],
    3: [11, 12, 13],
    4: [11, 12, 13],
    5: [],
    6: [],
    7: [],
  });
});

test("touch tap after horizontal scrolling changes one hour and keeps every target at least 44px wide", async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    "A real touchscreen tap is verified by the touch projects.",
  );
  const requests = await setup(page);
  await openSchedule(page, "Touch grid contract");
  const grid = page.getByRole("dialog").locator(".scheduler");
  const scroll = page.getByRole("dialog").locator(".scheduler-scroll");
  await scroll.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
  });
  expect(
    await scroll.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
  await expect(grid.locator(".scheduler-active")).toHaveCount(0);
  const cell = page.getByRole("button", {
    name: "Пятница, 22:00 UTC",
    exact: true,
  });
  await cell.scrollIntoViewIfNeeded();
  expect((await cell.boundingBox())!.width).toBeGreaterThanOrEqual(43.9);
  await cell.tap();
  await expect(grid.locator(".scheduler-active")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Пятница, 22:00 UTC", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const payload = await createdSchedule(page, requests);
  expect(payload).toEqual({
    1: [],
    2: [],
    3: [],
    4: [],
    5: [22],
    6: [],
    7: [],
  });
});

test("scheduler keyboard navigation and touch-range adapter preserve original selection logic", async ({
  page,
}) => {
  await setup(page);
  await openSchedule(page, "Adapter contract");
  const grid = page.getByRole("dialog").locator(".scheduler");
  const first = page.getByRole("button", {
    name: "Понедельник, 00:00 UTC",
    exact: true,
  });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Понедельник, 00:00 UTC", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Понедельник, 01:00 UTC", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(grid.locator(".scheduler-active")).toHaveCount(2);
  await page.getByRole("button", { name: "Очистить", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Выделение диапазона касанием",
      exact: true,
    }),
  ).toHaveCount(0);
  await grid
    .locator('.scheduler-hour[data-row="2"][data-col="3"]')
    .scrollIntoViewIfNeeded();
  // Dispatch the same PointerEvent sequence delivered by touch/pen hardware; the desktop test above verifies native mouse dragging.
  await grid.evaluate((element) => {
    const start = element.querySelector<HTMLElement>(
      '.scheduler-hour[data-row="1"][data-col="1"]',
    )!;
    const end = element.querySelector<HTMLElement>(
      '.scheduler-hour[data-row="2"][data-col="3"]',
    )!;
    const a = start.getBoundingClientRect(),
      b = end.getBoundingClientRect();
    const pointer = {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      pointerId: 41,
      isPrimary: true,
      buttons: 1,
    };
    // Synthetic pointers cannot acquire native capture; ignore that one browser API so the adapter receives the same events.
    const scroll = element.parentElement!;
    const originalCapture = scroll.setPointerCapture;
    scroll.setPointerCapture = () => {};
    start.dispatchEvent(
      new PointerEvent("pointerdown", {
        ...pointer,
        clientX: a.x + a.width / 2,
        clientY: a.y + a.height / 2,
      }),
    );
    scroll.dispatchEvent(
      new PointerEvent("pointermove", {
        ...pointer,
        clientX: b.x + b.width / 2,
        clientY: b.y + b.height / 2,
      }),
    );
    scroll.dispatchEvent(
      new PointerEvent("pointerup", {
        ...pointer,
        buttons: 0,
        clientX: b.x + b.width / 2,
        clientY: b.y + b.height / 2,
      }),
    );
    scroll.setPointerCapture = originalCapture;
  });
  await expect(grid.locator(".scheduler-active")).toHaveCount(6);
});

test("editing roundtrips the weekly selection and reuses the original runtime after closing the wizard", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/campaigns/91");
  await openCampaignSettings(page);
  const grid = page.getByRole("dialog").locator(".scheduler");
  await expect(grid.locator(".scheduler-active")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Понедельник, 09:00 UTC", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Весь день: Среда", exact: true })
    .click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.method === "PUT" && request.path === "/campaigns/91",
      ),
    )
    .toBe(true);
  const schedule = requests.find(
    (request) => request.method === "PUT" && request.path === "/campaigns/91",
  )!.body.schedule;
  expect(schedule).toEqual({
    1: [],
    2: [],
    3: Array.from({ length: 24 }, (_, hour) => hour),
    4: [],
    5: [],
    6: [],
    7: [],
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openCampaignSettings(page);
  await expect(
    page.getByRole("dialog").locator(".scheduler-active"),
  ).toHaveCount(24);
  await expect(
    page.getByRole("button", { name: "Среда, 23:00 UTC", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('script[src="/vendor/jquery.min.js"]')).toHaveCount(
    1,
  );
  await expect(page.locator('script[src="/vendor/scheduler.js"]')).toHaveCount(
    1,
  );
});

test("English wizard and original scheduler are localized while keeping UTC and the API field names unchanged", async ({
  page,
}) => {
  const requests = await setup(page, { language: "en" });
  await page.goto("/campaigns");
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  await page.locator("#field-name").fill("English schedule contract");
  await page.locator("#field-data_text").fill("79990000001;Alex");
  await page.getByRole("button", { name: "Next", exact: false }).click();
  await page.locator("#field-msg_template").fill("Hello, {field_1}");
  await page.getByRole("button", { name: "Next", exact: false }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("dialog").getByRole("tab", { name: /Schedule/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Whole day: Monday", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select a range by touch", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Drag across cells to select a range. Swipe the hour or weekday headers to scroll.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sunday, 21:00 UTC", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: false }).click();
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await expect
    .poll(() =>
      requests.some(
        (request) =>
          request.method === "POST" && request.path === "/campaigns/",
      ),
    )
    .toBe(true);
  const payload = requests.find(
    (request) => request.method === "POST" && request.path === "/campaigns/",
  )!.body;
  expect(payload.name).toBe("English schedule contract");
  expect(payload.schedule).toEqual({
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [21],
  });
  expect(payload.msg_template).toBe("Hello, {field_1}");
});

test("campaign form preserves original groups, real switches and contained scheduler width", async ({
  page,
}) => {
  await setup(page);
  await openForm(page, "Original composition");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[data-separator="sep0"]')).toHaveCount(1);
  await expect(dialog.locator('[data-separator="sep1"]')).toHaveCount(1);
  await expect(
    dialog.getByRole("switch", {
      name: "Проверить номера получателей",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Колонка телефона", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Данные получателей", { exact: true })
    .fill("79990000001;Иван");
  await next(page);
  await expect(
    dialog.getByLabel("Колонка телефона", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("switch", {
      name: "Автоматически сокращать ссылки",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("switch", {
      name: "Отдельная короткая ссылка для каждого получателя",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByLabel("Шаблон сообщения", { exact: false }).fill("Тест");
  await next(page);
  await expect(dialog.locator(".scheduler-hour")).toHaveCount(168);
  await expect(
    dialog.getByRole("button", {
      name: "Выделение диапазона касанием",
      exact: true,
    }),
  ).toHaveCount(0);
  const containment = await dialog.evaluate((element) => {
    const body = element.querySelector(".modal-body")!,
      form = element.querySelector(".campaign-form")!,
      scroll = element.querySelector(".scheduler-scroll")!;
    return {
      page: document.documentElement.scrollWidth <= innerWidth,
      dialog: element.scrollWidth <= element.clientWidth + 1,
      body: body.scrollWidth <= body.clientWidth + 1,
      // Section dividers intentionally bleed through the form's side padding.
      form: form.getBoundingClientRect().right <= body.getBoundingClientRect().right + 1,
      gridScrollable: scroll.scrollWidth > scroll.clientWidth,
    };
  });
  expect(containment.page).toBe(true);
  expect(containment.dialog).toBe(true);
  expect(containment.body).toBe(true);
  expect(containment.form).toBe(true);
  if (page.viewportSize()!.width < 1000)
    expect(containment.gridScrollable).toBe(true);
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.goto("/campaigns/91");
  await openCampaignSettings(page);
  await expect(page.getByRole("dialog").getByRole("tablist")).toHaveCount(0);
  for (const separator of [
    "sep1",
    "sep2",
    "sep3",
    "sep4",
    "sep7",
    "sep8",
    "sep9",
  ])
    await expect(
      page.getByRole("dialog").locator(`[data-separator="${separator}"]`),
    ).toHaveCount(1);
  await expect(
    page.getByRole("dialog").getByLabel("Попытки отправки", { exact: true }),
  ).toBeVisible();
});

test("campaign toolbar uses one control height and does not display the campaign ID", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/campaigns/91");
  const toolbar = page.locator(".campaign-actions");
  await expect(
    toolbar.getByRole("link", { name: "Все кампании", exact: true }),
  ).toBeVisible();
  await expect(toolbar.getByText("#91", { exact: true })).toHaveCount(0);
  const heights = await toolbar.evaluate((element) =>
    [
      ...element.querySelectorAll<HTMLElement>(
        ".campaign-toolbar-control,.campaign-toolbar-status",
      ),
    ]
      .filter((control) => control.getBoundingClientRect().width > 0)
      .map((control) => control.getBoundingClientRect().height),
  );
  expect(heights.length).toBeGreaterThanOrEqual(3);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  await expect(page.locator(".campaign-info")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Шаблон, расписание и дополнительные сведения",
      exact: true,
    }),
  ).toHaveCount(0);
  await openCampaignSettings(page);
  await expect(
    page.getByRole("dialog").getByLabel("Шаблон сообщения", { exact: false }),
  ).toHaveValue(existing.msg_template);
  await expect(page.getByRole("dialog").locator(".scheduler-hour")).toHaveCount(
    168,
  );
});

test("native touch swipes scroll hour headers and always select ranges inside the grid", async ({
  page,
  isMobile,
  browserName,
}) => {
  test.skip(
    !isMobile || browserName !== "chromium",
    "Native swipe injection requires Chromium CDP; WebKit is covered by real taps and the pointer adapter contract.",
  );
  const requests = await setup(page);
  await openSchedule(page, "Native touch range");
  const dialog = page.getByRole("dialog"),
    grid = dialog.locator(".scheduler"),
    scroll = dialog.locator(".scheduler-scroll");
  await grid.locator("thead").scrollIntoViewIfNeeded();
  await scroll.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const viewport = (await scroll.boundingBox())!,
    head = (await grid.locator("thead tr").last().boundingBox())!;
  const session = await page.context().newCDPSession(page);
  async function swipe(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    for (let step = 1; step <= 10; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * step) / 10,
            y: start.y + ((end.y - start.y) * step) / 10,
            id: 1,
          },
        ],
      });
      await page.waitForTimeout(16);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await swipe(
    {
      x: viewport.x + Math.min(190, viewport.width - 30),
      y: head.y + head.height / 2,
    },
    { x: viewport.x + 25, y: head.y + head.height / 2 },
  );
  await expect
    .poll(() => scroll.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(30);
  await expect(grid.locator(".scheduler-active")).toHaveCount(0);
  await scroll.evaluate((element) => {
    element.scrollLeft = 4 * 44;
  });
  const start = grid.locator('.scheduler-hour[data-row="2"][data-col="5"]'),
    end = grid.locator('.scheduler-hour[data-row="3"][data-col="7"]');
  await end.scrollIntoViewIfNeeded();
  const a = (await start.boundingBox())!,
    b = (await end.boundingBox())!;
  await swipe(
    { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  await expect(grid.locator(".scheduler-active")).toHaveCount(6);
  const schedule = await createdSchedule(page, requests);
  expect(schedule).toEqual({
    1: [],
    2: [5, 6, 7],
    3: [5, 6, 7],
    4: [],
    5: [],
    6: [],
    7: [],
  });
  await session.detach();
});

test("all six campaign metrics have progress bars in the requested order, below the toolbar", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/campaigns/91");
  const statistics = page.locator(".campaign-statistics");
  const expectedOrder = [
    "msg_total",
    "msg_sent",
    "link_clicks",
    "msg_delivered",
    "msg_undelivered",
    "msg_failed",
  ];
  await expect(statistics.locator(".campaign-stat")).toHaveCount(6);
  expect(
    await statistics
      .locator(".campaign-stat")
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-stat-key")),
      ),
  ).toEqual(expectedOrder);
  await expect(statistics.getByRole("progressbar")).toHaveCount(6);
  await expect(
    statistics.getByRole("progressbar", { name: "Всего", exact: true }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(
    statistics.getByRole("progressbar", { name: "Клики", exact: true }),
  ).toHaveAttribute("aria-valuenow", "0");
  const toolbar = (await page.locator(".campaign-actions").boundingBox())!,
    stats = (await statistics.boundingBox())!;
  expect(stats.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  expect(stats.x).toBeGreaterThanOrEqual(0);
  expect(stats.x + stats.width).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  expect(
    await page
      .locator(".data-table-stage")
      .evaluate((element) => element.clientHeight),
  ).toBeGreaterThan(60);
  expect(
    requests.some(
      (request) =>
        request.method !== "GET" && request.path !== "/auth/test-token",
    ),
  ).toBe(false);
});

test("scheduler has no duplicate outer frame or trailing divider and neutral headers ignore accent changes", async ({
  page,
}) => {
  await setup(page);
  await openSchedule(page, "Neutral schedule frame");
  const dialog = page.getByRole("dialog"),
    scheduler = dialog.locator(".o3go-weekly-scheduler");
  await expect(dialog.locator('[data-separator="sep18"]')).toHaveCount(0);
  expect(
    await scheduler.evaluate((element) => element.nextElementSibling),
  ).toBeNull();
  const frame = await dialog
    .locator(".scheduler-scroll")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ];
    });
  expect(frame).toEqual(["0px", "0px", "0px", "0px"]);
  const headers = () =>
    scheduler
      .locator("thead th,.scheduler-day-toggle")
      .evaluateAll((cells) =>
        cells.map((cell) => getComputedStyle(cell).backgroundColor),
      );
  const neutral = await headers();
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--primary", "#ff0000");
    document.documentElement.style.setProperty("--hover", "#00ff00");
    document.documentElement.style.setProperty("--secondary", "#0000ff");
  });
  expect(await headers()).toEqual(neutral);
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.goto("/campaigns/91");
  await openCampaignSettings(page);
  await expect(
    page.getByRole("dialog").locator('[data-separator="sep10"]'),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog").locator(".scheduler-hour")).toHaveCount(
    168,
  );
  expect(
    await page
      .getByRole("dialog")
      .locator(".o3go-weekly-scheduler")
      .evaluate((element) => element.nextElementSibling),
  ).toBeNull();
});
