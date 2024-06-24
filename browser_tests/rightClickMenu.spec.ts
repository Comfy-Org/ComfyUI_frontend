import { expect } from '@playwright/test';
import { comfyPageFixture as test } from './ComfyPage';

test.describe('Canvas Right Click Menu', () => {
    test('Can add node', async ({ comfyPage }) => {
        await comfyPage.rightClickCanvas();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png');
        await comfyPage.page.getByText('Add Node').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-node-menu.png');
        await comfyPage.page.getByText('loaders').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-node-menu-loaders.png');
        await comfyPage.page.getByText('Load VAE').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-node-node-added.png');
    });

    test('Can add group', async ({ comfyPage }) => {
        await comfyPage.rightClickCanvas();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-menu.png');
        await comfyPage.page.getByText('Add Group', { exact: true }).click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('add-group-group-added.png');
    });
});

test.describe('Node Right Click Menu', () => {
    test('Can open properties panel', async ({ comfyPage }) => {
        await comfyPage.rightClickEmptyLatentNode();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node.png');
        await comfyPage.page.getByText('Properties Panel').click();
        await comfyPage.nextFrame();
        await expect(comfyPage.canvas).toHaveScreenshot('right-click-node-properties-panel.png');
    });
});
