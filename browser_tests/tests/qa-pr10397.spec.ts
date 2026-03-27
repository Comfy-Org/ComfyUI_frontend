import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Select Component Escape Key Propagation', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Ensure clean state
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('pressing Escape in a Select dropdown closes only the menu and not the parent dialog', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    // 1. Open the Settings dialog
    await comfyPage.menu.topbar.openTopbarMenu()
    await page.getByRole('menuitem', { name: 'Settings' }).click()

    const settingsDialog = page.getByRole('dialog')
    await expect(settingsDialog).toBeVisible()

    // 2. Open a Select dropdown (e.g., Language)
    // Select components in ComfyUI use aria-haspopup="listbox"
    const selectTrigger = settingsDialog
      .locator('button[aria-haspopup="listbox"]')
      .first()
    await selectTrigger.click()

    // Verify the dropdown menu is open
    const dropdownContent = page.locator('[data-dismissable-layer]')
    await expect(dropdownContent).toBeVisible()

    // 3. Press Escape
    // This should close the dropdown but NOT the Settings dialog
    await page.keyboard.press('Escape')

    // 4. Assertions
    await expect(dropdownContent).not.toBeVisible()
    await expect(settingsDialog).toBeVisible()

    // Visual verification that the dialog is still present and focused
    await expect(settingsDialog).toHaveScreenshot(
      'settings-dialog-remains-open.png'
    )

    // 5. Press Escape again
    // Now that the dropdown is closed, Escape should close the dialog
    await page.keyboard.press('Escape')
    await expect(settingsDialog).not.toBeVisible()
  })
})
