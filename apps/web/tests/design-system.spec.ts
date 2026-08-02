import { expect, test } from "@playwright/test";

test("design-system preview applies theme, contrast, focus, and reduced-motion states", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dev/design-system");
  await expect(page.getByRole("heading", { name: "Game Store design system" })).toBeVisible();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "HC light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await expect(page.locator('[data-game-theme="property-empire"]')).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const disabled = page.getByRole("button", { name: "Disabled" });
  await expect(disabled).toBeDisabled();
  const primary = page.getByRole("button", { name: "Primary" });
  await primary.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(primary).toBeFocused();
  expect(await primary.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  const roomCode = page.getByRole("textbox", { name: "Room code example" });
  await roomCode.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(roomCode).toBeFocused();
  expect(await roomCode.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  expect(Number.parseFloat(await primary.evaluate((element) => getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.001);
});
