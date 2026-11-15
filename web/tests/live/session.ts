import { expect, type Page } from "@playwright/test";

export async function authHeaders(page: Page) {
  const token = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("campaigner.workspace.session") || "null");
    return session?.access_token;
  });
  expect(token).toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

export async function login(page: Page) {
  await page.addInitScript(() => localStorage.setItem("campaigner.preferences", JSON.stringify({
    version: 2, theme: "dark", accent: "green", language: "ru", tableMode: "auto",
  })));
  await page.goto("/campaigns");
  await page.getByLabel("Логин", { exact: true }).fill(process.env.E2E_LOGIN || "admin");
  await page.getByLabel("Пароль", { exact: true }).fill(process.env.E2E_PASSWORD || "admin");
  await page.getByRole("button", { name: "Войти в рабочее пространство", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Рассылки", exact: true })).toBeVisible();
}
