import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Node Library Search Highlighting', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Ensure a clean state
    await comfyPage.workflow.setupWorkflowsDirectory({})

    // Open the Node Library sidebar tab
    // Based on the UI, this is typically the 4th icon in the sidebar
    const nodeLibraryTabButton = comfyPage.page
      .locator('.side-bar-button')
      .nth(3)
    await nodeLibraryTabButton.click()

    // Wait for the search input to be ready
    const searchInput = comfyPage.page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible()
  })

  test('should highlight matching text in node search results', async ({
    comfyPage
  }) => {
    const searchInput = comfyPage.page.locator('input[placeholder*="Search"]')

    // Search for a common node prefix
    await searchInput.fill('Load')

    // The PR implements highlighting using a span with the .highlight class
    const highlight = comfyPage.page.locator('.highlight').first()

    // Assert that highlighting is visible and contains the search term
    await expect(highlight).toBeVisible()
    await expect(highlight).toHaveText(/Load/i)

    // Verify the highlight has the expected styling classes from the PR
    // (font-bold and white text as defined in the Tailwind classes)
    const fontWeight = await highlight.evaluate(
      (el) => window.getComputedStyle(el).fontWeight
    )
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(700)
  })

  test('should correctly highlight specific matches and maintain visual consistency', async ({
    comfyPage
  }) => {
    const searchInput = comfyPage.page.locator('input[placeholder*="Search"]')

    // Search for "Checkpoint" to find "Load Checkpoint"
    await searchInput.fill('Checkpoint')

    // Find the specific tree item for Load Checkpoint
    const nodeItem = comfyPage.page
      .locator('[role="treeitem"]')
      .filter({ hasText: 'Load Checkpoint' })
      .first()
    await expect(nodeItem).toBeVisible()

    // Verify that the "Checkpoint" portion is the one wrapped in the highlight span
    const highlight = nodeItem.locator('.highlight')
    await expect(highlight).toHaveText('Checkpoint')

    // Visual assertion to ensure the highlight background and rounding look correct
    await expect(nodeItem).toHaveScreenshot('node-search-highlighting.png')
  })
})
