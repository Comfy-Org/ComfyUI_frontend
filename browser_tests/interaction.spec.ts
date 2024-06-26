import { expect } from '@playwright/test';
import { comfyPageFixture as test } from './ComfyPage';

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

  test('Can pan', async ({ comfyPage }) => {
    await comfyPage.pan({ x: 200, y: 200 });
    await expect(comfyPage.canvas).toHaveScreenshot('panned.png');
  });
});
