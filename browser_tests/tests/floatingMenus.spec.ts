import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('Floating Canvas Menus', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.setup()
  })

  test('Floating menu is visible on canvas', async ({ comfyPage }) => {
    const toggleLinkButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleLinkVisibilityButton
    )
    const toggleMinimapButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )
    await expect(toggleLinkButton).toBeVisible()
    await expect(toggleMinimapButton).toBeVisible()
  })

  test('Link visibility toggle button is present', async ({ comfyPage }) => {
    const button = comfyPage.page.getByTestId(
      TestIds.canvas.toggleLinkVisibilityButton
    )
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()
  })

  test('Clicking link toggle changes link render mode', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.LinkRenderMode', 2)
    const button = comfyPage.page.getByTestId(
      TestIds.canvas.toggleLinkVisibilityButton
    )

    await button.click()
    await comfyPage.nextFrame()

    const hiddenLinkRenderMode = await comfyPage.page.evaluate(() => {
      return window.LiteGraph!.HIDDEN_LINK
    })
    expect(await comfyPage.settings.getSetting('Comfy.LinkRenderMode')).toBe(
      hiddenLinkRenderMode
    )
  })

  test('Zoom controls button shows percentage', async ({ comfyPage }) => {
    const zoomButton = comfyPage.page.getByTestId('zoom-controls-button')
    await expect(zoomButton).toBeVisible()
    await expect(zoomButton).toContainText('%')
  })

  test('Fit view button is present and clickable', async ({ comfyPage }) => {
    const fitViewButton = comfyPage.page
      .locator('button')
      .filter({ has: comfyPage.page.locator('.icon-\\[lucide--focus\\]') })
    await expect(fitViewButton).toBeVisible()
    await fitViewButton.click()
    await comfyPage.nextFrame()
  })

  test('Zoom controls popup opens on click', async ({ comfyPage }) => {
    const zoomButton = comfyPage.page.getByTestId('zoom-controls-button')
    await zoomButton.click()
    await comfyPage.nextFrame()

    const zoomModal = comfyPage.page.getByText('Zoom To Fit')
    await expect(zoomModal).toBeVisible()
  })
})
