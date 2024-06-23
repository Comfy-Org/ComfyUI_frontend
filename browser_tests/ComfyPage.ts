import type { Page, Locator } from '@playwright/test';

export class ComfyPage {
  public readonly url: string;
  // All canvas position operations are based on default view of canvas.
  public readonly canvas: Locator;
  public readonly widgetTextBox: Locator;

  // Buttons
  public readonly resetViewButton: Locator;

  constructor(
    public readonly page: Page,
    url: string = 'http://localhost:5173/'
  ) {
    this.url = url;
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
}