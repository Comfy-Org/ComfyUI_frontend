import { expect } from "@playwright/test";
import { comfyPageFixture, ComfyPage } from "./ComfyPage";

const test = comfyPageFixture.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ comfyPage }, use) => {
    await comfyPage.page.evaluate(async () => {
      await window["app"].ui.settings.setSettingValueAsync(
        "Comfy.UseNewMenu",
        "Top"
      );
    });
    await use(comfyPage);
  },
});

test.describe("Menu", () => {
  test("Should have setting button visible", async ({ comfyPage }) => {
    await expect(comfyPage.menu.settingsButton).toBeVisible();
  });
});
