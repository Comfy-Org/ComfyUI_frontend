import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('Widget copy button', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()

    await comfyPage.nodeOps.addNode('PreviewAny')

    await comfyPage.vueNodes.waitForNodes()
  })

  test('Copy button has correct aria-label', async ({ comfyPage }) => {
    const copyButton = comfyPage.page
      .locator('[data-node-id] button[aria-label]')
      .filter({ has: comfyPage.page.locator('.icon-\\[lucide--copy\\]') })
      .first()
    await expect(copyButton).toBeAttached()
    await expect(copyButton).toHaveAttribute('aria-label', /copy/i)
  })

  test('Copy button exists within textarea widget group container', async ({
    comfyPage
  }) => {
    const container = comfyPage.page
      .locator('[data-node-id] div.group:has(textarea[readonly])')
      .first()
    await expect(container).toBeVisible()
    await container.hover()
    await comfyPage.nextFrame()

    const copyButton = container.locator('button').filter({
      has: comfyPage.page.locator('.icon-\\[lucide--copy\\]')
    })
    await expect(copyButton.first()).toBeAttached()
  })
})
