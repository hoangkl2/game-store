import { expect, test } from "@playwright/test";

test("animation preview queues commands, respects reduced motion, and recovers safely", async ({ page }) => {
  await page.goto("/dev/animation");
  await expect(page.getByRole("heading", { name: "Animation queue" })).toBeVisible();
  const playing = expect(page.getByText(/PLAYING: DICE_SETTLED/)).toBeVisible();
  const blocked = expect(page.getByText("Relevant input blocked: yes")).toBeVisible();
  await page.getByRole("button", { name: "Enqueue critical" }).click();
  await Promise.all([playing, blocked]);
  await page.getByRole("button", { name: "REDUCED" }).click();
  await expect(page.getByText("Reduced motion effective: yes")).toBeVisible();
  await page.getByRole("button", { name: "Simulate reconnect" }).click();
  await expect(page.getByText("Connection stable.")).toBeVisible();
});
