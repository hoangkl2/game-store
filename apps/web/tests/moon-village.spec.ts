import { expect, test, type Page } from "@playwright/test";

const roleNames = ["Hearth Tender", "Dusk Prowler", "Star Reader", "Gate Warden", "Dew Brewer", "Bell Ranger"];

async function actUntilFinished(page: Page) {
  for (let step = 0; step < 90; step += 1) {
    if (await page.getByText(/Team (Dawn|Dusk) prevails|village rests in balance/i).isVisible().catch(() => false)) return;
    const heading = page.getByRole("heading", { name: "Your authorized action" });
    if (await heading.isVisible().catch(() => false)) {
      const panel = heading.locator(".."); const buttons = panel.getByRole("button");
      const count = await buttons.count();
      if (count > 0 && await buttons.first().isEnabled()) {
        await buttons.first().focus();
        if (count > 1) await buttons.first().press("ArrowRight");
        await page.locator(":focus").press("Enter");
      }
    }
    await page.waitForTimeout(100);
  }
  throw new Error("Moon Village quick vigil did not finish");
}

test("Moon Village private offline flow saves, resumes, and reveals roles only at finish", async ({ page }) => {
  await page.goto("/games/moon-village");
  await expect(page.getByRole("heading", { name: "Moon Village" })).toBeVisible();
  await page.getByRole("link", { name: "Play offline" }).click();
  await page.getByRole("button", { name: /Short vigil/ }).click();
  await page.getByRole("button", { name: "HARD" }).click();
  await page.getByRole("button", { name: "fast" }).click();
  await Promise.all([page.waitForURL(/\/games\/moon-village\/play/), page.getByRole("link", { name: "Enter Moon Village" }).click()]);

  await expect(page.getByText("Your moon seal is covered")).toBeVisible();
  for (const role of roleNames) await expect(page.getByText(role, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal my role" }).click();
  const visibleRoleCount = await Promise.all(roleNames.map((role) => page.getByText(role, { exact: true }).count()));
  expect(visibleRoleCount.reduce((total, count) => total + count, 0)).toBe(1);
  await page.getByRole("button", { name: "I understand - begin" }).click();

  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Save game" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Moon Village saved privately on this device." })).toBeVisible();
  await page.getByRole("button", { name: "Resume saved" }).click();
  await expect(page.locator("p.text-success").filter({ hasText: "Saved Moon Village game resumed with your private projection." })).toBeVisible();

  await actUntilFinished(page);
  await expect(page.getByText("The complete role ledger is revealed only because the match is finished.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Change setup" })).toBeVisible();
});

test("Moon Village remains operable on mobile with reduced motion and forced colors", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/games/moon-village/play?preset=quick&difficulty=easy&speed=fast");
  await expect(page.getByRole("heading", { name: "Moon Village" })).toBeVisible();
  await page.getByRole("button", { name: "Reveal my role" }).click();
  await expect(page.getByText("Your private role", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Village circle" })).toBeVisible();
  await expect(page.locator("[data-motion='reduced']")).toBeVisible();
  await page.getByRole("button", { name: "I understand - begin" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
});
