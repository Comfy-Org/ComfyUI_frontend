import { expect } from "@playwright/test";
import { comfyPageFixture as test } from "./ComfyPage";

test.describe("Menu", () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(async () => {
      await window["app"].ui.settings.setSettingValueAsync(
        "Comfy.UseNewMenu",
        "Top"
      );
    });
  });

  test.afterEach(async ({ comfyPage }) => {
    const currentThemeId = await comfyPage.menu.getThemeId();
    if (currentThemeId !== "dark") {
      await comfyPage.menu.toggleTheme();
    }
    await comfyPage.page.evaluate(async () => {
      await window["app"].ui.settings.setSettingValueAsync(
        "Comfy.UseNewMenu",
        "Disabled"
      );
    });
  });

  test("Toggle theme", async ({ comfyPage }) => {
    test.setTimeout(30000);

    expect(await comfyPage.menu.getThemeId()).toBe("dark");

    await comfyPage.menu.toggleTheme();

    expect(await comfyPage.menu.getThemeId()).toBe("light");

    // Theme id should persist after reload.
    await comfyPage.page.reload();
    await comfyPage.setup();
    expect(await comfyPage.menu.getThemeId()).toBe("light");

    await comfyPage.menu.toggleTheme();

    expect(await comfyPage.menu.getThemeId()).toBe("dark");
  });
});
