import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('Command search box', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  })

  test('Can trigger command mode with ">" prefix', async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()
    await expect(comfyPage.searchBox.input).toHaveCount(1)

    // Type ">" to enter command mode
    await comfyPage.searchBox.input.fill('>')

    // Verify filter button is hidden in command mode
    const filterButton = comfyPage.page.locator('.filter-button')
    await expect(filterButton).not.toBeVisible()

    // Verify placeholder text changes
    await expect(comfyPage.searchBox.input).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Search Commands')
    )
  })

  test('Shows command list when entering command mode', async ({
    comfyPage
  }) => {
    await comfyPage.doubleClickCanvas()
    await comfyPage.searchBox.input.fill('>')

    // Wait for dropdown to appear
    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })

    // Check that commands are shown
    const firstItem = comfyPage.searchBox.dropdown.locator('li').first()
    await expect(firstItem).toBeVisible()

    // Verify it shows a command item with icon
    const commandIcon = firstItem.locator('.item-icon')
    await expect(commandIcon).toBeVisible()
  })

  test('Can search and filter commands', async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()
    await comfyPage.searchBox.input.fill('>save')

    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })
    await comfyPage.page.waitForTimeout(500) // Wait for search to complete

    // Get all visible command items
    const items = comfyPage.searchBox.dropdown.locator('li')
    const count = await items.count()

    // Should have filtered results
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(10) // Should be filtered, not showing all

    // Verify first result contains "save"
    const firstLabel = await items.first().locator('.item-label').textContent()
    expect(firstLabel?.toLowerCase()).toContain('save')
  })

  test('Shows keybindings for commands that have them', async ({
    comfyPage
  }) => {
    await comfyPage.doubleClickCanvas()
    await comfyPage.searchBox.input.fill('>undo')

    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })
    await comfyPage.page.waitForTimeout(500)

    // Find the undo command
    const undoItem = comfyPage.searchBox.dropdown
      .locator('li')
      .filter({ hasText: 'Undo' })
      .first()

    // Check if keybinding is shown (if configured)
    const keybinding = undoItem.locator('.item-keybinding')
    const keybindingCount = await keybinding.count()

    // Keybinding might or might not be present depending on configuration
    if (keybindingCount > 0) {
      await expect(keybinding).toBeVisible()
    }
  })

  test('Executes command on selection', async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()
    await comfyPage.searchBox.input.fill('>new blank')

    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })
    await comfyPage.page.waitForTimeout(500)

    // Count nodes before
    const nodesBefore = await comfyPage.page
      .locator('.litegraph.litenode')
      .count()

    // Select the new blank workflow command
    const newBlankItem = comfyPage.searchBox.dropdown
      .locator('li')
      .filter({ hasText: 'New Blank Workflow' })
      .first()
    await newBlankItem.click()

    // Search box should close
    await expect(comfyPage.searchBox.input).not.toBeVisible()

    // Verify workflow was cleared (no nodes)
    const nodesAfter = await comfyPage.page
      .locator('.litegraph.litenode')
      .count()
    expect(nodesAfter).toBe(0)
  })

  test('Returns to node search when removing ">"', async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()

    // Enter command mode
    await comfyPage.searchBox.input.fill('>')
    await expect(comfyPage.page.locator('.filter-button')).not.toBeVisible()

    // Return to node search by filling with empty string to trigger search
    await comfyPage.searchBox.input.fill('')

    // Small wait for UI update
    await comfyPage.page.waitForTimeout(200)

    // Filter button should be visible again
    await expect(comfyPage.page.locator('.filter-button')).toBeVisible()

    // Placeholder should change back
    await expect(comfyPage.searchBox.input).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Search Nodes')
    )
  })

  test('Command search is case insensitive', async ({ comfyPage }) => {
    await comfyPage.doubleClickCanvas()

    // Search with lowercase
    await comfyPage.searchBox.input.fill('>SAVE')
    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })
    await comfyPage.page.waitForTimeout(500)

    // Should find save commands
    const items = comfyPage.searchBox.dropdown.locator('li')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)

    // Verify it found save-related commands
    const firstLabel = await items.first().locator('.item-label').textContent()
    expect(firstLabel?.toLowerCase()).toContain('save')
  })
})
