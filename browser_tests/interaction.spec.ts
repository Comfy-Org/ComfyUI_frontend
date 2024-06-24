import { test as base, expect } from '@playwright/test';
import { ComfyPage } from './ComfyPage';

const test = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page }, use) => {
    const comfyPage = new ComfyPage(page);
    await comfyPage.goto();
    // Unify font for consistent screenshots.
    await page.addStyleTag({
      url: "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap"
    });
    await page.addStyleTag({
      url: "https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap"
    });
    await page.addStyleTag({
      content: `
      * {
				font-family: 'Roboto Mono', 'Noto Color Emoji';
			}`
    });

    await page.waitForFunction(() => document.fonts.ready);
    await page.waitForFunction(() => window['app'] != undefined);
    await page.evaluate(() => { window['app']['canvas'].show_info = false; });
    await comfyPage.nextFrame();
    // Reset view to force re-rendering of canvas. So that info fields like fps
    // become hidden.
    await comfyPage.resetView();
    await use(comfyPage);
  },
});

test.describe('Node Interaction', () => {
  test('Can enter prompt', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox;
    await textBox.click();
    await textBox.fill('Hello World');
    await expect(textBox).toHaveValue('Hello World');
    await textBox.fill('Hello World 2');
    await expect(textBox).toHaveValue('Hello World 2');
  });

  test('Can highlight selected', async ({ comfyPage }) => {
    await expect(comfyPage.canvas).toHaveScreenshot('default.png');
    await comfyPage.clickTextEncodeNode1();
    await expect(comfyPage.canvas).toHaveScreenshot('selected-node1.png');
    await comfyPage.clickTextEncodeNode2();
    await expect(comfyPage.canvas).toHaveScreenshot('selected-node2.png');
  });

  // Flaky. See https://github.com/comfyanonymous/ComfyUI/issues/3866
  test.skip('Can drag node', async ({ comfyPage }) => {
    await comfyPage.dragNode2();
    await expect(comfyPage.canvas).toHaveScreenshot('dragged-node1.png');
  });

  test('Can disconnect/connect edge', async ({ comfyPage }) => {
    await comfyPage.disconnectEdge();
    await expect(comfyPage.canvas).toHaveScreenshot('disconnected-edge-with-menu.png');
    await comfyPage.connectEdge();
    // Litegraph renders edge with a slight offset.
    await expect(comfyPage.canvas).toHaveScreenshot('default.png', { maxDiffPixels: 50 });
  });

  test('Can adjust widget value', async ({ comfyPage }) => {
    await comfyPage.adjustWidgetValue();
    await expect(comfyPage.canvas).toHaveScreenshot('adjusted-widget-value.png');
  });
});

test.describe('Canvas Interaction', () => {
  test('Can zoom in/out', async ({ comfyPage }) => {
    await comfyPage.zoom(-100);
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-in.png');
    await comfyPage.zoom(200);
    await expect(comfyPage.canvas).toHaveScreenshot('zoomed-out.png');
  });
});
