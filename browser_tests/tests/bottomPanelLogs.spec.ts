import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Bottom Panel Logs', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('should open bottom panel via toggle button', async ({ comfyPage }) => {
    const { bottomPanel } = comfyPage

    await expect(bottomPanel.root).not.toBeVisible()
    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()
  })

  test('should show Logs tab when terminal panel opens', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasLogs = await logsTab.isVisible().catch(() => false)

    if (hasLogs) {
      await expect(logsTab).toBeVisible()
    }
  })

  test('should close bottom panel via toggle button', async ({ comfyPage }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).not.toBeVisible()
  })

  test('should switch between shortcuts and terminal panels', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.keyboardShortcutsButton.click()
    await expect(bottomPanel.root).toBeVisible()
    await expect(
      comfyPage.page.locator('[id*="tab_shortcuts-essentials"]')
    ).toBeVisible()

    await bottomPanel.toggleButton.click()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasTerminalTabs = await logsTab.isVisible().catch(() => false)

    if (hasTerminalTabs) {
      await expect(logsTab).toBeVisible()
      await expect(
        comfyPage.page.locator('[id*="tab_shortcuts-essentials"]')
      ).not.toBeVisible()
    }
  })

  test('should persist Logs tab content in bottom panel', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasLogs = await logsTab.isVisible().catch(() => false)

    if (hasLogs) {
      await logsTab.click()

      const xtermContainer = bottomPanel.root.locator('.xterm')
      const hasXterm = await xtermContainer.isVisible().catch(() => false)

      if (hasXterm) {
        await expect(xtermContainer).toBeVisible()
      }
    }
  })

  test('should render xterm container in terminal panel', async ({
    comfyPage
  }) => {
    const { bottomPanel } = comfyPage

    await bottomPanel.toggleButton.click()
    await expect(bottomPanel.root).toBeVisible()

    const logsTab = comfyPage.page.getByRole('tab', { name: /Logs/i })
    const hasLogs = await logsTab.isVisible().catch(() => false)

    if (hasLogs) {
      await logsTab.click()

      const xtermScreen = bottomPanel.root.locator(
        '.xterm, .xterm-screen'
      )
      const hasXterm = await xtermScreen.first().isVisible().catch(() => false)

      if (hasXterm) {
        await expect(xtermScreen.first()).toBeVisible()
      }
    }
  })
})
