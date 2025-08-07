import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Bottom Panel Shortcuts', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('should toggle shortcuts panel visibility', async ({ comfyPage }) => {
    // Initially shortcuts panel should be hidden
    await expect(comfyPage.page.locator('.bottom-panel')).not.toBeVisible()

    // Click shortcuts toggle button in sidebar
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Shortcuts panel should now be visible
    await expect(comfyPage.page.locator('.bottom-panel')).toBeVisible()

    // Click toggle button again to hide
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Panel should be hidden again
    await expect(comfyPage.page.locator('.bottom-panel')).not.toBeVisible()
  })

  test('should display essentials shortcuts tab', async ({ comfyPage }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Essentials tab should be visible and active by default
    await expect(
      comfyPage.page.getByRole('tab', { name: /Essential/i })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('tab', { name: /Essential/i })
    ).toHaveAttribute('aria-selected', 'true')

    // Should display shortcut categories
    await expect(
      comfyPage.page.locator('.subcategory-title').first()
    ).toBeVisible()

    // Should display some keyboard shortcuts
    await expect(comfyPage.page.locator('.key-badge').first()).toBeVisible()

    // Should have workflow, node, and queue sections
    await expect(
      comfyPage.page.getByRole('heading', { name: 'Workflow' })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('heading', { name: 'Node' })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('heading', { name: 'Queue' })
    ).toBeVisible()
  })

  test('should display view controls shortcuts tab', async ({ comfyPage }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Click view controls tab
    await comfyPage.page.getByRole('tab', { name: /View Controls/i }).click()

    // View controls tab should be active
    await expect(
      comfyPage.page.getByRole('tab', { name: /View Controls/i })
    ).toHaveAttribute('aria-selected', 'true')

    // Should display view controls shortcuts
    await expect(comfyPage.page.locator('.key-badge').first()).toBeVisible()

    // Should have view and panel controls sections
    await expect(
      comfyPage.page.getByRole('heading', { name: 'View' })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('heading', { name: 'Panel Controls' })
    ).toBeVisible()
  })

  test('should switch between shortcuts tabs', async ({ comfyPage }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Essentials should be active initially
    await expect(
      comfyPage.page.getByRole('tab', { name: /Essential/i })
    ).toHaveAttribute('aria-selected', 'true')

    // Click view controls tab
    await comfyPage.page.getByRole('tab', { name: /View Controls/i }).click()

    // View controls should now be active
    await expect(
      comfyPage.page.getByRole('tab', { name: /View Controls/i })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(
      comfyPage.page.getByRole('tab', { name: /Essential/i })
    ).not.toHaveAttribute('aria-selected', 'true')

    // Switch back to essentials
    await comfyPage.page.getByRole('tab', { name: /Essential/i }).click()

    // Essentials should be active again
    await expect(
      comfyPage.page.getByRole('tab', { name: /Essential/i })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(
      comfyPage.page.getByRole('tab', { name: /View Controls/i })
    ).not.toHaveAttribute('aria-selected', 'true')
  })

  test('should display formatted keyboard shortcuts', async ({ comfyPage }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Wait for shortcuts to load
    await comfyPage.page.waitForSelector('.key-badge')

    // Check for common formatted keys
    const keyBadges = comfyPage.page.locator('.key-badge')
    const count = await keyBadges.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // Should show formatted modifier keys
    const badgeText = await keyBadges.allTextContents()
    const hasModifiers = badgeText.some((text) =>
      ['Ctrl', 'Cmd', 'Shift', 'Alt'].includes(text)
    )
    expect(hasModifiers).toBeTruthy()
  })

  test('should maintain panel state when switching to terminal', async ({
    comfyPage
  }) => {
    // Open shortcuts panel first
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()
    await expect(comfyPage.page.locator('.bottom-panel')).toBeVisible()

    // Open terminal panel (should switch panels)
    await comfyPage.page
      .locator('button[aria-label*="Toggle Bottom Panel"]')
      .click()

    // Panel should still be visible but showing terminal content
    await expect(comfyPage.page.locator('.bottom-panel')).toBeVisible()

    // Switch back to shortcuts
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Should show shortcuts content again
    await expect(
      comfyPage.page.locator('[id*="tab_shortcuts-essentials"]')
    ).toBeVisible()
  })

  test('should handle keyboard navigation', async ({ comfyPage }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Focus the first tab
    await comfyPage.page.getByRole('tab', { name: /Essential/i }).focus()

    // Use arrow keys to navigate between tabs
    await comfyPage.page.keyboard.press('ArrowRight')

    // View controls tab should now have focus
    await expect(
      comfyPage.page.getByRole('tab', { name: /View Controls/i })
    ).toBeFocused()

    // Press Enter to activate the tab
    await comfyPage.page.keyboard.press('Enter')

    // Tab should be selected
    await expect(
      comfyPage.page.getByRole('tab', { name: /View Controls/i })
    ).toHaveAttribute('aria-selected', 'true')
  })

  test('should close panel by clicking shortcuts button again', async ({
    comfyPage
  }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()
    await expect(comfyPage.page.locator('.bottom-panel')).toBeVisible()

    // Click shortcuts button again to close
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Panel should be hidden
    await expect(comfyPage.page.locator('.bottom-panel')).not.toBeVisible()
  })

  test('should display shortcuts in organized columns', async ({
    comfyPage
  }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Should have 3-column grid layout
    await expect(comfyPage.page.locator('.md\\:grid-cols-3')).toBeVisible()

    // Should have multiple subcategory sections
    const subcategoryTitles = comfyPage.page.locator('.subcategory-title')
    const titleCount = await subcategoryTitles.count()
    expect(titleCount).toBeGreaterThanOrEqual(2)
  })

  test('should open shortcuts panel with Ctrl+Shift+K', async ({
    comfyPage
  }) => {
    // Initially shortcuts panel should be hidden
    await expect(comfyPage.page.locator('.bottom-panel')).not.toBeVisible()

    // Press Ctrl+Shift+K to open shortcuts panel
    await comfyPage.page.keyboard.press('Control+Shift+KeyK')

    // Shortcuts panel should now be visible
    await expect(comfyPage.page.locator('.bottom-panel')).toBeVisible()

    // Should show essentials tab by default
    await expect(
      comfyPage.page.getByRole('tab', { name: /Essential/i })
    ).toHaveAttribute('aria-selected', 'true')
  })

  test('should open settings dialog when clicking manage shortcuts button', async ({
    comfyPage
  }) => {
    // Open shortcuts panel
    await comfyPage.page
      .locator('button[aria-label*="Keyboard Shortcuts"]')
      .click()

    // Manage shortcuts button should be visible
    await expect(
      comfyPage.page.getByRole('button', { name: /Manage Shortcuts/i })
    ).toBeVisible()

    // Click manage shortcuts button
    await comfyPage.page
      .getByRole('button', { name: /Manage Shortcuts/i })
      .click()

    // Settings dialog should open with keybinding tab
    await expect(comfyPage.page.getByRole('dialog')).toBeVisible()

    // Should show keybinding settings (check for keybinding-related content)
    await expect(
      comfyPage.page.getByRole('option', { name: 'Keybinding' })
    ).toBeVisible()
  })
})
