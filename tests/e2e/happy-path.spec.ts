import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD for a seeded Neon Auth workspace member.");

test("shared task and event happy path", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByTestId("tandem-app")).toBeVisible();

  const unique = Date.now();
  const taskTitle = `E2E shared task ${unique}`;
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByRole("tab", { name: "Task" }).click();
  await page.getByLabel("Title").fill(taskTitle);
  await page.getByLabel("Due date").fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
  await expect(page.getByTestId("month-view").getByText(taskTitle)).toBeVisible();
  await page.getByRole("checkbox", { name: `Complete ${taskTitle}` }).click();

  const eventTitle = `E2E event ${unique}`;
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Title").fill(eventTitle);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(eventTitle)).toBeVisible();
  await page.getByText(eventTitle).click();
  await page.getByLabel("Title").fill(`${eventTitle} edited`);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText(`${eventTitle} edited`).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(`${eventTitle} edited`)).toHaveCount(0);
});
