import { expect } from '@playwright/test'

import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Combo text widget', () => {
  test('Truncates text when resized', async ({ comfyPage }) => {
    await comfyPage.resizeLoadCheckpointNode(0.2, 1)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'load-checkpoint-resized-min-width.png'
    )
    await comfyPage.closeMenu()
    await comfyPage.resizeKsamplerNode(0.2, 1)
    await expect(comfyPage.canvas).toHaveScreenshot(
      `ksampler-resized-min-width.png`
    )
  })

  test("Doesn't truncate when space still available", async ({ comfyPage }) => {
    await comfyPage.resizeEmptyLatentNode(0.8, 0.8)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'empty-latent-resized-80-percent.png'
    )
  })

  test('Can revert to full text', async ({ comfyPage }) => {
    await comfyPage.resizeLoadCheckpointNode(0.8, 1, true)
    await expect(comfyPage.canvas).toHaveScreenshot('resized-to-original.png')
  })
})

test.describe('Boolean widget', () => {
  test('Can toggle', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('widgets/boolean_widget')
    await expect(comfyPage.canvas).toHaveScreenshot('boolean_widget.png')
    const node = (await comfyPage.getFirstNodeRef())!
    const widget = await node.getWidget(0)
    await widget.click()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'boolean_widget_toggled.png'
    )
  })
})
