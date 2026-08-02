import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD for a seeded Neon Auth workspace member.");

test("personal My List creation, preferences, and persistence", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Login" }).click();
  await page.goto("/app/my-list");
  await expect(page.getByTestId("my-list-app")).toBeVisible();
  await expect(page.getByRole("tab", { name: "My List" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Private")).toHaveAttribute("data-state", "on");

  const today = page.locator("[data-agenda-day]").filter({ hasText: "Today" });
  const content = `My List E2E ${Date.now()}`;
  await today.getByLabel(/New My List item/).first().fill(content);
  await today.getByLabel(/New My List item/).first().press("Enter");
  await expect(today.getByLabel(`My List item: ${content}`)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`My List item: ${content}`)).toBeVisible();

  await page.getByLabel("Show 1 day").click();
  expect(await page.locator("[data-agenda-day]").count()).toBeLessThanOrEqual(2); // Today plus optional yesterday.
  await page.getByLabel("Show 3 days").click();
  expect(await page.locator("[data-agenda-day]").count()).toBeGreaterThanOrEqual(3);

  await page.getByLabel("Visible to workspace").click();
  await expect(page.getByText("My List shared with your workspace")).toBeVisible();
  await page.getByLabel("Private").click();
  await expect(page.getByText("My List is private")).toBeVisible();

  await page.getByRole("button", { name: `Delete ${content}` }).click();
  await expect(page.getByLabel(`My List item: ${content}`)).toHaveCount(0);
});
