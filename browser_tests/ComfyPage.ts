import type { Page, Locator } from "@playwright/test";
import { test as base } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config();

interface Position {
  x: number;
  y: number;
}

class ComfyNodeSearchBox {
  public readonly input: Locator;
  public readonly dropdown: Locator;

  constructor(public readonly page: Page) {
    this.input = page.locator(
      '.comfy-vue-node-search-container input[type="text"]'
    );
    this.dropdown = page.locator(
      ".comfy-vue-node-search-container .p-autocomplete-list"
    );
  }

  async fillAndSelectFirstNode(nodeName: string) {
    await this.input.waitFor({ state: "visible" });
    await this.input.fill(nodeName);
    await this.dropdown.waitFor({ state: "visible" });
    await this.dropdown.locator("li").nth(0).click();
  }
}

export class ComfyPage {
  public readonly url: string;
  // All canvas position operations are based on default view of canvas.
  public readonly canvas: Locator;
  public readonly widgetTextBox: Locator;

  // Buttons
  public readonly resetViewButton: Locator;

  // Search box
  public readonly searchBox: ComfyNodeSearchBox;

  constructor(public readonly page: Page) {
    this.url = process.env.PLAYWRIGHT_TEST_URL || "http://localhost:8188";
    this.canvas = page.locator("#graph-canvas");
    this.widgetTextBox = page.getByPlaceholder("text").nth(1);
    this.resetViewButton = page.getByRole("button", { name: "Reset View" });
    this.searchBox = new ComfyNodeSearchBox(page);
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async nextFrame() {
    await this.page.evaluate(() => {
      return new Promise<number>(requestAnimationFrame);
    });
  }

  async resetView() {
    await this.resetViewButton.click();
    // Avoid "Reset View" button highlight.
    await this.page.mouse.move(10, 10);
    await this.nextFrame();
  }

  async clickTextEncodeNode1() {
    await this.canvas.click({
      position: {
        x: 618,
        y: 191,
      },
    });
    await this.nextFrame();
  }

  async clickTextEncodeNode2() {
    await this.canvas.click({
      position: {
        x: 622,
        y: 400,
      },
    });
    await this.nextFrame();
  }

  async clickEmptySpace() {
    await this.canvas.click({
      position: {
        x: 35,
        y: 31,
      },
    });
    await this.nextFrame();
  }

  async dragAndDrop(source: Position, target: Position) {
    await this.page.mouse.move(source.x, source.y);
    await this.page.mouse.down();
    await this.page.mouse.move(target.x, target.y);
    await this.page.mouse.up();
    await this.nextFrame();
  }

  async dragNode2() {
    await this.dragAndDrop({ x: 622, y: 400 }, { x: 622, y: 300 });
    await this.nextFrame();
  }

  async disconnectEdge() {
    // CLIP input anchor
    await this.page.mouse.move(427, 198);
    await this.page.mouse.down();
    await this.page.mouse.move(427, 98);
    await this.page.mouse.up();
    // Move out the way to avoid highlight of menu item.
    await this.page.mouse.move(10, 10);
    await this.nextFrame();
  }

  async connectEdge() {
    // CLIP output anchor on Load Checkpoint Node.
    await this.page.mouse.move(332, 509);
    await this.page.mouse.down();
    // CLIP input anchor on CLIP Text Encode Node.
    await this.page.mouse.move(427, 198);
    await this.page.mouse.up();
    await this.nextFrame();
  }

  async adjustWidgetValue() {
    // Adjust Empty Latent Image's width input.
    const page = this.page;
    await page.locator("#graph-canvas").click({
      position: {
        x: 724,
        y: 645,
      },
    });
    await page.locator('input[type="text"]').click();
    await page.locator('input[type="text"]').fill("128");
    await page.locator('input[type="text"]').press("Enter");
    await this.nextFrame();
  }

  async zoom(deltaY: number) {
    await this.page.mouse.move(10, 10);
    await this.page.mouse.wheel(0, deltaY);
    await this.nextFrame();
  }

  async pan(offset: Position) {
    await this.page.mouse.move(10, 10);
    await this.page.mouse.down();
    await this.page.mouse.move(offset.x, offset.y);
    await this.page.mouse.up();
    await this.nextFrame();
  }

  async rightClickCanvas() {
    await this.page.mouse.click(10, 10, { button: "right" });
    await this.nextFrame();
  }

  async doubleClickCanvas() {
    await this.page.mouse.dblclick(10, 10);
    await this.nextFrame();
  }

  async clickEmptyLatentNode() {
    await this.canvas.click({
      position: {
        x: 724,
        y: 625,
      },
    });
    this.page.mouse.move(10, 10);
    await this.nextFrame();
  }

  async rightClickEmptyLatentNode() {
    await this.canvas.click({
      position: {
        x: 724,
        y: 645,
      },
      button: "right",
    });
    this.page.mouse.move(10, 10);
    await this.nextFrame();
  }

  async select2Nodes() {
    // Select 2 CLIP nodes.
    await this.page.keyboard.down("Control");
    await this.clickTextEncodeNode1();
    await this.clickTextEncodeNode2();
    await this.page.keyboard.up("Control");
    await this.nextFrame();
  }

  async ctrlC() {
    await this.page.keyboard.down("Control");
    await this.page.keyboard.press("KeyC");
    await this.page.keyboard.up("Control");
    await this.nextFrame();
  }

  async ctrlV() {
    await this.page.keyboard.down("Control");
    await this.page.keyboard.press("KeyV");
    await this.page.keyboard.up("Control");
    await this.nextFrame();
  }
}

export const comfyPageFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page }, use) => {
    const comfyPage = new ComfyPage(page);
    await comfyPage.goto();
    await page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener("comfy:vue-app-loaded", resolve, {
          once: true,
        });
      });
    });
    // Unify font for consistent screenshots.
    await page.addStyleTag({
      url: "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap",
    });
    await page.addStyleTag({
      url: "https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap",
    });
    await page.addStyleTag({
      content: `
      * {
				font-family: 'Roboto Mono', 'Noto Color Emoji';
			}`,
    });
    await page.waitForFunction(() => document.fonts.ready);

    await page.evaluate(() => {
      window["app"]["canvas"].show_info = false;
    });
    await comfyPage.nextFrame();
    // Reset view to force re-rendering of canvas. So that info fields like fps
    // become hidden.
    await comfyPage.resetView();
    await use(comfyPage);
  },
});
