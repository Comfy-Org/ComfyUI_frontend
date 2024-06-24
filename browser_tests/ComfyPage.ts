import type { Page, Locator } from '@playwright/test';
import dotenv from "dotenv";
dotenv.config();

interface Position {
  x: number;
  y: number;
}

export class ComfyPage {
  public readonly url: string;
  // All canvas position operations are based on default view of canvas.
  public readonly canvas: Locator;
  public readonly widgetTextBox: Locator;

  // Buttons
  public readonly resetViewButton: Locator;

  constructor(
    public readonly page: Page,
  ) {
    this.url = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188';
    this.canvas = page.locator('#graph-canvas');
    this.widgetTextBox = page.getByPlaceholder('text').nth(1);
    this.resetViewButton = page.getByRole('button', { name: 'Reset View' });
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
    await this.nextFrame();
  }

  async clickTextEncodeNode1() {
    await this.canvas.click({
      position: {
        x: 618,
        y: 191
      }
    });
    await this.nextFrame();
  }

  async clickTextEncodeNode2() {
    await this.canvas.click({
      position: {
        x: 622,
        y: 400
      }
    });
    await this.nextFrame();
  }

  async clickEmptySpace() {
    await this.canvas.click({
      position: {
        x: 35,
        y: 31
      }
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
    await this.dragAndDrop(
      { x: 622, y: 400 },
      { x: 622, y: 300 },
    );
    await this.nextFrame();
  }

  async disconnectEdge() {
    // CLIP input anchor
    await this.page.mouse.move(427, 198);
    await this.page.mouse.down();
    await this.page.mouse.move(427, 98);
    await this.page.mouse.up();
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
    await page.locator('#graph-canvas').click({
      position: {
        x: 724,
        y: 645
      }
    });
    await page.locator('input[type="text"]').click();
    await page.locator('input[type="text"]').fill('128');
    await page.locator('input[type="text"]').press('Enter');
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
}