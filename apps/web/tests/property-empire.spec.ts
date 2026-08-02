import { expect, test } from "@playwright/test";

test("Property Empire completes the approved offline economic flow", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/games/property-empire");
  await expect(page.getByRole("heading", { level: 1, name: "Property Empire" })).toBeVisible();
  await Promise.all([page.waitForURL(/\/games\/property-empire\/setup$/), page.getByRole("link", { name: "Play offline" }).click()]);

  await expect(page).toHaveURL(/\/games\/property-empire\/setup$/);
  await expect(page.getByRole("heading", { name: "Plan your city route" })).toBeVisible();
  await page.getByRole("button", { name: "Quick / 1 bot / 10 turns" }).click();
  await page.getByRole("button", { name: "HARD" }).click();
  await page.getByRole("button", { name: "fast" }).click();
  await Promise.all([page.waitForURL(/\/games\/property-empire\/play\?preset=quick&difficulty=hard&speed=fast$/), page.getByRole("link", { name: "Start Property Empire" }).click()]);

  await expect(page).toHaveURL(/\/games\/property-empire\/play\?preset=quick&difficulty=hard&speed=fast$/);
  await expect(page.getByRole("grid", { name: "Property Empire 20-tile serpentine city route" })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(20);

  const tiles = page.locator("[data-property-tile='true']");
  await tiles.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Copper Quay" })).toBeVisible();

  const roll = page.getByRole("button", { name: "Roll dice" });
  const endTurn = page.getByRole("button", { name: "End turn" });
  await roll.click();
  await endTurn.click();
  await expect(roll).toBeEnabled({ timeout: 10_000 });
  await roll.click();
  await expect(page.getByRole("heading", { name: "Purchase decision" })).toBeVisible();
  await page.getByRole("button", { name: "Buy site" }).click();
  await expect(page.getByText(/You purchased/).last()).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  const dialog = page.getByRole("dialog", { name: "Economic round paused" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "Exit without saving" })).toBeFocused();
  await page.getByRole("button", { name: "Save game" }).click();
  await expect(page.getByText("Property Empire saved on this device.").last()).toBeVisible();
  await page.getByRole("button", { name: "Resume saved" }).click();
  await expect(page.getByText("Saved Property Empire game resumed.").last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeFocused();

  for (let step = 0; step < 120 && await page.getByRole("heading", { name: "Empire results" }).count() === 0; step += 1) {
    if (await roll.isEnabled()) await roll.click();
    const buy = page.getByRole("button", { name: "Buy site" });
    const decline = page.getByRole("button", { name: "Decline" });
    if (await buy.isEnabled()) await buy.click();
    else if (await decline.isEnabled()) await decline.click();
    if (await endTurn.isEnabled()) await endTurn.click();
    await page.waitForTimeout(60);
  }
  await expect(page.getByRole("heading", { name: "Empire results" })).toBeVisible();
  await expect(page.getByText(/Estimated net worth/).last()).toBeVisible();
});

test("Property Empire keeps its board and required action reachable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/games/property-empire/play?preset=quick&difficulty=normal&speed=fast");
  await expect(page.getByRole("grid", { name: "Property Empire 20-tile serpentine city route" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Roll dice" })).toBeInViewport();
  await expect(page.locator("[data-property-tile='true']").first()).toHaveCSS("min-height", "80px");
});
