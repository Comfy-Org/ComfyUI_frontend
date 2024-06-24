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
});

test.describe('Node Right Click Menu', () => {

});