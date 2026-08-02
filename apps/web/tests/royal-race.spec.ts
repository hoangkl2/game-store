import { expect, test } from "@playwright/test";

test("Royal Race detail, setup, and offline turn flow", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/games/royal-race");
  await expect(page.getByRole("heading", { level: 1, name: "Royal Race" })).toBeVisible();
  await Promise.all([page.waitForURL(/\/games\/royal-race\/setup$/), page.getByRole("link", { name: "Play offline" }).click()]);

  await expect(page).toHaveURL(/\/games\/royal-race\/setup$/);
  await expect(page.getByRole("heading", { level: 1, name: "Prepare the Royal Race" })).toBeVisible();
  await page.getByRole("button", { name: "Quick / 1 bot / 1 token" }).click();
  await page.getByRole("button", { name: "fast" }).click();
  await Promise.all([page.waitForURL(/\/games\/royal-race\/play\?preset=quick&speed=fast$/), page.getByRole("link", { name: "Start offline race" }).click()]);
  await expect(page.getByRole("grid", { name: "Royal Race board, 24-cell compass loop" })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(24);
  await expect(page.getByRole("button", { name: /circle token 1/i })).toBeDisabled();

  const roll = page.getByRole("button", { name: "Roll dice" });
  await roll.focus();
  await expect(roll).toBeFocused();
  await roll.click();
  await expect(page.getByText(/rolled|no legal move|thinking/i).last()).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  const pauseDialog = page.getByRole("dialog", { name: "Paused" });
  await expect(pauseDialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Exit without saving" })).toBeFocused();
  await page.getByRole("button", { name: "Save game" }).click();
  await expect(page.getByText("Royal Race saved on this device.").last()).toBeVisible();
  await page.getByRole("button", { name: "Resume saved" }).click();
  await expect(page.getByText("Saved Royal Race resumed.").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeFocused();

  const token = page.locator("[data-royal-token='true']").first();
  const move = page.getByRole("button", { name: "Move selected" });
  for (let step = 0; step < 240 && await page.getByRole("heading", { name: "Race complete" }).count() === 0; step += 1) {
    if (await roll.isEnabled()) await roll.click();
    if (await token.isEnabled()) {
      await token.click();
      await move.click();
    }
    await page.waitForTimeout(50);
  }
  await expect(page.getByRole("heading", { name: "Race complete" })).toBeVisible();
  await expect(page.getByText(/^Ranking:/)).toContainText("1.");
});

test("Royal Race action bar remains available on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/games/royal-race/play");
  await expect(page.getByRole("button", { name: "Roll dice" })).toBeInViewport();
  await expect(page.getByRole("grid", { name: "Royal Race board, 24-cell compass loop" })).toBeVisible();
});
