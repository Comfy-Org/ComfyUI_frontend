import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test.describe('Bottom Panel', { tag: '@ui' }, () => {
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

  test('preserves a resized panel when the sidebar remounts the layout', async ({
    comfyPage
  }) => {
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

    const resizedHeight = await bottomPanel.root.evaluate(
      (el) => el.getBoundingClientRect().height
    )
    await comfyPage.settings.setSetting('Comfy.Sidebar.Location', 'right')
    await expect
      .poll(() =>
        bottomPanel.root.evaluate((el) => el.getBoundingClientRect().height)
      )
      .toBeCloseTo(resizedHeight, 0)
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

  test('associates shortcut tabs with their panels during keyboard navigation', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage
    const { essentialsTab, viewControlsTab } = bottomPanel.shortcuts
    await bottomPanel.keyboardShortcutsButton.click()

    const essentials = bottomPanel.root.getByRole('tabpanel', {
      name: /Essential/i
    })
    await expect(essentials).toBeVisible()
    await expect(essentialsTab).toHaveAttribute(
      'aria-controls',
      (await essentials.getAttribute('id')) ?? ''
    )

    await essentialsTab.focus()
    await essentialsTab.press('ArrowRight')

    const viewControls = bottomPanel.root.getByRole('tabpanel', {
      name: /View Controls/i
    })
    await expect(viewControlsTab).toBeFocused()
    await expect(viewControls).toBeVisible()
    await expect(viewControlsTab).toHaveAttribute(
      'aria-controls',
      (await viewControls.getAttribute('id')) ?? ''
    )
    await expect(essentials).toBeHidden()
  })
})
