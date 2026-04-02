import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Bottom Panel', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('should close panel via close button inside the panel', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    await bottomPanel.closeButton.click()
    await expect(bottomPanel.root).not.toBeVisible()
  })

  test('should display resize gutter when panel is open', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()
    await expect(bottomPanel.resizeGutter).toBeVisible()
  })

  test('should hide resize gutter when panel is closed', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await expect(bottomPanel.root).not.toBeVisible()
    await expect(bottomPanel.resizeGutter).toBeHidden()
  })

  test('should resize panel by dragging the gutter', async ({ comfyPage }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    const initialHeight = await bottomPanel.root.evaluate(
      (el) => el.getBoundingClientRect().height
    )

    const gutterBox = await bottomPanel.resizeGutter.boundingBox()
    expect(gutterBox, 'Resize gutter should have layout').not.toBeNull()

    const gutterCenterX = gutterBox!.x + gutterBox!.width / 2
    const gutterCenterY = gutterBox!.y + gutterBox!.height / 2

    // Drag gutter upward to enlarge the bottom panel
    await comfyPage.page.mouse.move(gutterCenterX, gutterCenterY)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(gutterCenterX, gutterCenterY - 100, {
      steps: 5
    })
    await comfyPage.page.mouse.up()

    const newHeight = await bottomPanel.root.evaluate(
      (el) => el.getBoundingClientRect().height
    )

    expect(newHeight).toBeGreaterThan(initialHeight)
  })

  test('should not block canvas interactions when panel is closed', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    // Ensure panel is closed
    await expect(bottomPanel.root).not.toBeVisible()

    // Click the canvas without `force` -- Playwright's actionability checks
    // will fail if an invisible overlay is intercepting pointer events.
    await comfyPage.canvas.click({
      position: { x: 100, y: 100 }
    })
  })

  test('should close panel via close button from shortcuts view', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.keyboardShortcutsButton.click()
    await expect(bottomPanel.root).toBeVisible()

    await bottomPanel.closeButton.click()
    await expect(bottomPanel.root).not.toBeVisible()
  })
})
