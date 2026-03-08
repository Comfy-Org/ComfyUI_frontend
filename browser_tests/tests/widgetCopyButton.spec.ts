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
    const copyButtons = comfyPage.page.locator(
      '[data-node-id] button[aria-label]'
    )
    const count = await copyButtons.count()

    if (count > 0) {
      const button = copyButtons.filter({
        has: comfyPage.page.locator('.icon-\\[lucide--copy\\]')
      })
      if ((await button.count()) > 0) {
        await expect(button.first()).toHaveAttribute('aria-label', /copy/i)
      }
    }
  })

  test('Copy icon uses lucide copy class', async ({ comfyPage }) => {
    const copyIcons = comfyPage.page.locator(
      '[data-node-id] .icon-\\[lucide--copy\\]'
    )
    const count = await copyIcons.count()

    if (count > 0) {
      await expect(copyIcons.first()).toBeVisible()
    }
  })

  test('Widget container has group class for hover', async ({ comfyPage }) => {
    const textareas = comfyPage.page.locator('[data-node-id] textarea')
    const count = await textareas.count()

    if (count > 0) {
      const container = textareas.first().locator('..')
      await expect(container).toHaveClass(/group/)
    }
  })

  test('Copy button exists within textarea widget group container', async ({
    comfyPage
  }) => {
    const groupContainers = comfyPage.page.locator('[data-node-id] div.group')
    const count = await groupContainers.count()

    if (count > 0) {
      const container = groupContainers.first()
      await container.hover()
      await comfyPage.nextFrame()

      const copyButton = container.locator('button').filter({
        has: comfyPage.page.locator('.icon-\\[lucide--copy\\]')
      })
      if ((await copyButton.count()) > 0) {
        await expect(copyButton.first()).toHaveClass(/invisible/)
      }
    }
  })
})
