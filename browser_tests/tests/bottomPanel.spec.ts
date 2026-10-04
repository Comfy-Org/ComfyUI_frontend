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

  test('should display resize handle when panel is open', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(
      bottomPanel.root,
      'Panel should be open before checking the resize handle'
    ).toBeVisible()
    await expect(bottomPanel.resizeHandle).toBeVisible()
  })

  test('should hide resize handle when panel is closed', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await expect(bottomPanel.root).toBeHidden()
    await expect(bottomPanel.resizeHandle).toBeHidden()
  })

  test('preserves a resized panel when the sidebar remounts the layout', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await test.step('Open and resize the bottom panel', async () => {
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
            bottomPanel.root.evaluate(
              (el) => el.getBoundingClientRect().height
            ),
          {
            message:
              'Panel height should increase after dragging the resize handle'
          }
        )
        .toBeGreaterThan(initialHeight)
    })

    const resizedHeight = await bottomPanel.root.evaluate(
      (el) => el.getBoundingClientRect().height
    )

    await test.step('Remount the layout and preserve the height', async () => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Location', 'right')
      await expect
        .poll(() =>
          bottomPanel.root.evaluate((el) => el.getBoundingClientRect().height)
        )
        .toBeCloseTo(resizedHeight, 0)
    })
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

    await test.step('Open the shortcuts panel', async () => {
      await bottomPanel.keyboardShortcutsButton.click()
    })

    const essentials = bottomPanel.root.getByRole('tabpanel', {
      name: /Essential/i
    })
    await expect(essentials).toBeVisible()
    await expect(essentialsTab).toHaveAttribute(
      'aria-controls',
      (await essentials.getAttribute('id')) ?? ''
    )

    await test.step('Navigate to View Controls with the keyboard', async () => {
      await essentialsTab.focus()
      await essentialsTab.press('ArrowRight')
    })

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
