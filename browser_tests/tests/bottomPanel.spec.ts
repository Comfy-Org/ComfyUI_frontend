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

  test('should remember last active tab when re-opening terminal panel', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasLogsTab = await logsTab.isVisible().catch(() => false)
    if (!hasLogsTab) {
      test.skip()
      return
    }

    // Logs should be active by default
    await expect(logsTab).toHaveAttribute('aria-selected', 'true')

    // Close then reopen
    await bottomPanel.closeButton.click()
    await expect(bottomPanel.root).not.toBeVisible()

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    // Logs tab should still be the active tab
    await expect(logsTab).toHaveAttribute('aria-selected', 'true')
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
    if (!gutterBox) {
      test.skip()
      return
    }

    const gutterCenterX = gutterBox.x + gutterBox.width / 2
    const gutterCenterY = gutterBox.y + gutterBox.height / 2

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

  test('should switch from shortcuts to terminal panel', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    // Open shortcuts panel first
    await bottomPanel.keyboardShortcutsButton.click()
    await expect(bottomPanel.root).toBeVisible()
    await expect(bottomPanel.shortcuts.essentialsTab).toBeVisible()

    // Click toggle button to switch to terminal panel
    await bottomPanel.toggleButton.click()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasTerminalTabs = await logsTab.isVisible().catch(() => false)

    if (hasTerminalTabs) {
      // Terminal panel is showing -- shortcuts tabs should not be visible
      await expect(bottomPanel.shortcuts.essentialsTab).not.toBeVisible()
      await expect(logsTab).toBeVisible()
    }
  })

  test('should switch from terminal to shortcuts panel', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    // Open terminal panel first
    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasTerminalTabs = await logsTab.isVisible().catch(() => false)
    if (!hasTerminalTabs) {
      test.skip()
      return
    }

    // Switch to shortcuts
    await bottomPanel.keyboardShortcutsButton.click()
    await expect(bottomPanel.shortcuts.essentialsTab).toBeVisible()
    await expect(logsTab).not.toBeVisible()
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

  test('should display all registered terminal tabs', async ({ comfyPage }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasTerminalTabs = await logsTab.isVisible().catch(() => false)
    if (!hasTerminalTabs) {
      test.skip()
      return
    }

    // At least the Logs tab should be present
    await expect(logsTab).toBeVisible()

    // The active tab should have aria-selected
    const tabs = bottomPanel.root.getByRole('tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(1)

    // Exactly one tab should be selected
    const selectedTabs = bottomPanel.root.locator(
      '[role="tab"][aria-selected="true"]'
    )
    await expect(selectedTabs).toHaveCount(1)
  })
})
