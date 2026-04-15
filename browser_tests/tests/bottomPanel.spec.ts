import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Bottom Panel', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('should close panel via close button inside the panel', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(
      bottomPanel.root,
      'Panel should be open before testing close button'
    ).toBeVisible()

    await bottomPanel.closeButton.click()
    await expect(bottomPanel.root).toBeHidden()
  })

  test('should display resize gutter when panel is open', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(
      bottomPanel.root,
      'Panel should be open before checking the resize gutter'
    ).toBeVisible()
    await expect(bottomPanel.resizeGutter).toBeVisible()
  })

  test('should hide resize gutter when panel is closed', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await expect(bottomPanel.root).toBeHidden()
    await expect(bottomPanel.resizeGutter).toBeHidden()
  })

  test('should resize panel by dragging the gutter', async ({ comfyPage }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(
      bottomPanel.root,
      'Panel should be open before resizing'
    ).toBeVisible()

    const initialHeight = await bottomPanel.root.evaluate(
      (el) => el.getBoundingClientRect().height
    )

    await bottomPanel.resizeByDragging(-100)

    await expect
      .poll(
        () =>
          bottomPanel.root.evaluate((el) => el.getBoundingClientRect().height),
        {
          message:
            'Panel height should increase after dragging the resize gutter'
        }
      )
      .toBeGreaterThan(initialHeight)
  })

  test('should not block canvas interactions when panel is closed', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await expect(bottomPanel.root).toBeHidden()

    await comfyPage.canvas.click({
      position: { x: 100, y: 100 }
    })
    await expect(comfyPage.canvas).toHaveFocus()
  })

  test('should close panel via close button from shortcuts view', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.keyboardShortcutsButton.click()
    await expect(
      bottomPanel.root,
      'Panel should be open before closing it from the shortcuts view'
    ).toBeVisible()

    await bottomPanel.closeButton.click()
    await expect(bottomPanel.root).toBeHidden()
  })
})
