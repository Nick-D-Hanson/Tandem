import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD for a seeded Neon Auth workspace member.");

test("weekly planner creation, scheduling, matrix priority, and persistence", async ({ page }) => {
  await page.goto("/sign-in?redirectTo=/app/my-list");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByTestId("task-workspace")).toBeVisible();

  const title = `Planner E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Add to backlog" }).click();
  await page.getByRole("textbox", { name: "Add to backlog" }).fill(title);
  await page.getByRole("textbox", { name: "Add to backlog" }).press("Enter");
  const task = page.getByTestId(/planner-task-/).filter({ hasText: title }).first();
  await expect(task).toBeVisible();

  const monday = page.locator('[data-planner-zone^="schedule:"]').first();
  await task.getByRole("button", { name: `Drag ${title}` }).dragTo(monday);
  await expect(monday.getByText(title)).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-planner-zone^="schedule:"]').first().getByText(title)).toBeVisible();

  await page.getByText(title, { exact: true }).click();
  await page.getByLabel("Eisenhower priority").selectOption("2");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("tab", { name: "Matrix" }).click();
  await expect(page.locator('[data-planner-zone="matrix:2"]').getByText(title)).toBeVisible();

  await page.getByRole("checkbox", { name: `Complete ${title}` }).click();
  await page.getByLabel("Show completed").check();
  await page.getByText(title, { exact: true }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});
