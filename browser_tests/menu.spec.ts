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
