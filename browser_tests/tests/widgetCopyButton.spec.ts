import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('Widget copy button', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('Vue nodes render with widgets', async ({ comfyPage }) => {
    const nodeCount = await comfyPage.vueNodes.getNodeCount()
    expect(nodeCount).toBeGreaterThan(0)

    const firstNode = comfyPage.vueNodes.nodes.first()
    await expect(firstNode).toBeVisible()
  })

  test('Textarea widgets exist on nodes', async ({ comfyPage }) => {
    const textareas = comfyPage.page.locator('[data-node-id] textarea')
    await expect(textareas.first()).toBeVisible()
    expect(await textareas.count()).toBeGreaterThan(0)
  })

  test('Copy button has correct aria-label', async ({ comfyPage }) => {
    const copyButton = comfyPage.page
      .locator('[data-node-id] button[aria-label]')
      .filter({ has: comfyPage.page.locator('.icon-\\[lucide--copy\\]') })
      .first()
    await expect(copyButton).toBeAttached()
    await expect(copyButton).toHaveAttribute('aria-label', /copy/i)
  })

  test('Copy icon uses lucide copy class', async ({ comfyPage }) => {
    const copyIcon = comfyPage.page
      .locator('[data-node-id] .icon-\\[lucide--copy\\]')
      .first()
    await expect(copyIcon).toBeAttached()
  })

  test('Widget container has group class for hover', async ({ comfyPage }) => {
    const textarea = comfyPage.page
      .locator('[data-node-id] textarea')
      .first()
    await expect(textarea).toBeVisible()
    const container = textarea.locator('..')
    await expect(container).toHaveClass(/group/)
  })

  test('Copy button exists within textarea widget group container', async ({
    comfyPage
  }) => {
    const container = comfyPage.page
      .locator('[data-node-id] div.group:has(textarea)')
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
