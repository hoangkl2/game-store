import { expect, test } from "@playwright/test";

test("audio preview provides captions and safe reconnect recovery", async ({ page }) => {
  await page.goto("/dev/audio");
  await expect(page.getByRole("heading", { name: "Audio system" })).toBeVisible();
  await page.getByRole("button", { name: "Queue public cue" }).click();
  await expect(page.getByText("Last caption: Preview cue played.")).toBeVisible();
  await page.getByRole("button", { name: "Master on" }).click();
  await expect(page.getByRole("button", { name: "Master off" })).toBeVisible();
  await page.getByRole("button", { name: "Simulate reconnect" }).click();
  await expect(page.getByText("Last caption: Resynchronized to the latest state.")).toBeVisible();
});
