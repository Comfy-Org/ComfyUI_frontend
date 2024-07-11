import { expect } from "@playwright/test";
import { comfyPageFixture as test } from "./ComfyPage";

test.describe("Node search box", () => {
  test("Can trigger on empty canvas double click", async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas();
    await expect(comfyPage.searchBoxInput).toHaveCount(1);
  });

  test("Can trigger on link release", async ({ comfyPage }) => {
    await comfyPage.page.keyboard.down("Shift");
    await comfyPage.disconnectEdge();
    await expect(comfyPage.searchBoxInput).toHaveCount(1);
  });

  test("Does not trigger on link release (no shift)", async ({ comfyPage }) => {
    await comfyPage.disconnectEdge();
    await expect(comfyPage.searchBoxInput).toHaveCount(0);
  });

  test("Can add node", async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas();
    await expect(comfyPage.searchBoxInput).toHaveCount(1);
    await comfyPage.searchBoxInput.fill("KSampler");
    await expect(comfyPage.searchBoxDropdown).toHaveCount(1);
    await comfyPage.searchBoxDropdown.locator("li").nth(0).click();
    await expect(comfyPage.canvas).toHaveScreenshot("added-node.png");
  });
});
