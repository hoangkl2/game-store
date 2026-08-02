import { expect, test } from "@playwright/test";

test("Color Clash starts offline from game detail and exposes accessible card play", async ({ page }) => {
  await page.goto("/games/color-clash");
  await page.getByRole("link", { name: "Play offline" }).click();
  await expect(page.getByRole("heading", { name: "Color Clash" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Draw", exact: true })).toBeVisible();
  const card = page.getByRole("region", { name: "Your hand" }).getByRole("button").first();
  await card.focus();
  await expect(card).toBeFocused();
});
