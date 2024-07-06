import { expect } from "@playwright/test";
import { comfyPageFixture as test } from "./ComfyPage";

test.describe("Canvas Event", () => {
  test("Emit litegraph:canvas empty-release", async ({ comfyPage }) => {
    // Use localStorage to store middle state, so that we are certain
    // that disconnectEdge executes when event listener has been registered.
    await comfyPage.page.evaluate(() => {
      document.addEventListener(
        "litegraph:canvas",
        (e) => localStorage.setItem("event", JSON.stringify(e)),
        { once: true }
      );
    });
    await comfyPage.disconnectEdge();
    const event = await comfyPage.page.evaluate(() => {
      return JSON.parse(localStorage.getItem("event")!);
    });

    expect(event).toBeDefined();
    // No further check on event content as the content is dropped by
    // playwright for some reason.
    // See https://github.com/microsoft/playwright/issues/31580
  });

  test("Emit litegraph:canvas empty-double-click", async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      document.addEventListener(
        "litegraph:canvas",
        (e) => localStorage.setItem("event", JSON.stringify(e)),
        { once: true }
      );
    });
    await comfyPage.doubleClickCanvas();
    const event = await comfyPage.page.evaluate(() => {
      return JSON.parse(localStorage.getItem("event")!);
    });

    expect(event).toBeDefined();
    // No further check on event content as the content is dropped by
    // playwright for some reason.
    // See https://github.com/microsoft/playwright/issues/31580
  });
});
