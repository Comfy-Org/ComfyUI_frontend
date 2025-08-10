import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

test.describe('Node search box - Issue #4887', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.LinkRelease.Action', 'search box')
    await comfyPage.setSetting('Comfy.LinkRelease.ActionShift', 'search box')
    await comfyPage.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  })

  test('Shows default nodes after clearing search input', async ({
    comfyPage
  }) => {
    // 1. Open the searchbox
    await comfyPage.doubleClickCanvas()
    await expect(comfyPage.searchBox.input).toHaveCount(1)

    // 2. Focus the input to trigger dropdown with default nodes
    await comfyPage.searchBox.input.focus()
    await comfyPage.page.waitForTimeout(200) // Wait for focus to trigger dropdown
    await comfyPage.searchBox.dropdown.waitFor({ state: 'visible' })
    const initialOptions = await comfyPage.searchBox.dropdown
      .locator('li')
      .count()
    expect(initialOptions).toBeGreaterThan(0)

    // 3. Type some text in the search input
    await comfyPage.searchBox.input.fill('image')
    await comfyPage.page.waitForTimeout(200) // Wait for debounced search

    // 4. Verify search results are shown
    const searchOptions = await comfyPage.searchBox.dropdown
      .locator('li')
      .count()
    expect(searchOptions).toBeGreaterThan(0)

    // 5. Clear all the text using backspace to return to empty input
    await comfyPage.searchBox.input.fill('')
    await comfyPage.page.waitForTimeout(200) // Wait for debounced search

    // 6. Verify that default nodes are displayed (same as initial state)
    const clearedOptions = await comfyPage.searchBox.dropdown
      .locator('li')
      .count()
    expect(clearedOptions).toBe(initialOptions)
    expect(clearedOptions).toBeGreaterThan(0)
  })
})
