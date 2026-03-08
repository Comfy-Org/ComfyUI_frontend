import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('Minimap Status', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.setup()
  })

  test('Minimap is visible when enabled', async ({ comfyPage }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()
  })

  test('Minimap contains canvas and viewport elements', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap.locator('.minimap-canvas')).toBeVisible()
    await expect(minimap.locator('.minimap-viewport')).toBeVisible()
  })

  test('Minimap toggle button exists in canvas menu', async ({ comfyPage }) => {
    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )
    await expect(toggleButton).toBeVisible()
  })

  test('Minimap can be hidden via toggle', async ({ comfyPage }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )

    await expect(minimap).toBeVisible()
    await toggleButton.click()
    await comfyPage.nextFrame()
    await expect(minimap).not.toBeVisible()
  })

  test('Minimap can be re-shown via toggle', async ({ comfyPage }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )

    await toggleButton.click()
    await comfyPage.nextFrame()
    await expect(minimap).not.toBeVisible()

    await toggleButton.click()
    await comfyPage.nextFrame()
    await expect(minimap).toBeVisible()
  })

  test('Minimap persists across queue operations', async ({ comfyPage }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()

    await comfyPage.command.executeCommand('Comfy.QueuePrompt')
    await comfyPage.nextFrame()

    await expect(minimap).toBeVisible()
  })
})
