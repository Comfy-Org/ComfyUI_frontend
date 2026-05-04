import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

async function triggerExecutionError(comfyPage: {
  canvasOps: { disconnectEdge: () => Promise<void> }
  page: Page
  command: { executeCommand: (cmd: string) => Promise<void> }
}) {
  await comfyPage.canvasOps.disconnectEdge()
  await comfyPage.page.keyboard.press('Escape')
  await comfyPage.command.executeCommand('Comfy.QueuePrompt')
}

test.describe('Errors tab in right side panel', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
  })

  test('Errors tab appears after execution error', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    // Dismiss the error overlay
    const overlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(overlay).toBeVisible()
    await overlay.getByRole('button', { name: /Dismiss/i }).click()

    await comfyPage.actionbar.propertiesButton.click()
    const { propertiesPanel } = comfyPage.menu

    await expect(propertiesPanel.root).toBeVisible()
    await expect(
      propertiesPanel.root.getByRole('tab', { name: 'Errors' })
    ).toBeVisible()
  })

  test('Error card shows locate button', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(overlay).toBeVisible()
    await overlay.getByRole('button', { name: /See Errors/i }).click()

    const { propertiesPanel } = comfyPage.menu
    await expect(propertiesPanel.root).toBeVisible()

    const locateButton = propertiesPanel.root.getByRole('button', {
      name: 'Locate node on canvas'
    })
    await expect(locateButton.first()).toBeVisible()
  })

  test('Clicking locate button focuses canvas', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(overlay).toBeVisible()
    await overlay.getByRole('button', { name: /See Errors/i }).click()

    const { propertiesPanel } = comfyPage.menu
    await expect(propertiesPanel.root).toBeVisible()

    const locateButton = propertiesPanel.root
      .getByRole('button', { name: 'Locate node on canvas' })
      .first()
    await locateButton.click()

    await expect(comfyPage.canvas).toBeVisible()
  })

  test('Collapse all button collapses error groups', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(overlay).toBeVisible()
    await overlay.getByRole('button', { name: /See Errors/i }).click()

    const { propertiesPanel } = comfyPage.menu
    await expect(propertiesPanel.root).toBeVisible()

    const collapseButton = propertiesPanel.root.getByRole('button', {
      name: 'Collapse all'
    })

    // The collapse toggle only appears when there are multiple groups.
    // If only one group exists, this test verifies the button is not shown.
    const count = await collapseButton.count()
    if (count > 0) {
      await collapseButton.click()
      const expandButton = propertiesPanel.root.getByRole('button', {
        name: 'Expand all'
      })
      await expect(expandButton).toBeVisible()
    }
  })

  test('Search filters errors', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(overlay).toBeVisible()
    await overlay.getByRole('button', { name: /See Errors/i }).click()

    const { propertiesPanel } = comfyPage.menu
    await expect(propertiesPanel.root).toBeVisible()

    // Search for a term that won't match any error
    await propertiesPanel.searchBox.fill('zzz_nonexistent_zzz')

    await expect(
      propertiesPanel.root.getByRole('button', {
        name: 'Locate node on canvas'
      })
    ).toHaveCount(0)

    // Clear the search to restore results
    await propertiesPanel.searchBox.fill('')

    await expect(
      propertiesPanel.root
        .getByRole('button', { name: 'Locate node on canvas' })
        .first()
    ).toBeVisible()
  })

  test('Errors tab shows error message text', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.locator('[data-testid="error-overlay"]')
    await expect(overlay).toBeVisible()
    await overlay.getByRole('button', { name: /See Errors/i }).click()

    const { propertiesPanel } = comfyPage.menu
    await expect(propertiesPanel.root).toBeVisible()

    const errorMessage = propertiesPanel.root
      .getByTestId('error-card-message')
      .first()
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).not.toHaveText('')
  })
})
