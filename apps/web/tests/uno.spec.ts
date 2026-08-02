import { expect, test } from "@playwright/test";

test("starts an UNO game and shows the player's hand", async ({ page }) => {
  await page.goto("/play/uno");
  await expect(page.getByRole("heading", { name: /UNO MVP/i })).toBeVisible();
  await expect(page.getByRole("region", { name: /your hand/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Draw" })).toBeVisible();
});
