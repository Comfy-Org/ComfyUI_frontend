import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Node search box V2 extended', { tag: '@node' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'default')
    await comfyPage.settings.setSetting(
      'Comfy.LinkRelease.Action',
      'search box'
    )
    await comfyPage.settings.setSetting(
      'Comfy.LinkRelease.ActionShift',
      'search box'
    )
    await comfyPage.searchBoxV2.reload(comfyPage)
  })

  test('Double-click on empty canvas opens search', async ({ comfyPage }) => {
    const { searchBoxV2 } = comfyPage

    await comfyPage.canvasOps.doubleClick()
    await expect(searchBoxV2.input).toBeVisible()
    await expect(searchBoxV2.dialog).toBeVisible()
  })

  test('Escape closes search box without adding node', async ({
    comfyPage
  }) => {
    const { searchBoxV2 } = comfyPage
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.canvasOps.doubleClick()
    await expect(searchBoxV2.input).toBeVisible()

    await searchBoxV2.input.fill('KSampler')
    await expect(searchBoxV2.results.first()).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(searchBoxV2.input).not.toBeVisible()

    const newCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(newCount).toBe(initialCount)
  })

  test('Search clears when reopening', async ({ comfyPage }) => {
    const { searchBoxV2 } = comfyPage

    await comfyPage.canvasOps.doubleClick()
    await expect(searchBoxV2.input).toBeVisible()

    await searchBoxV2.input.fill('KSampler')
    await expect(searchBoxV2.results.first()).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(searchBoxV2.input).not.toBeVisible()

    await comfyPage.canvasOps.doubleClick()
    await expect(searchBoxV2.input).toBeVisible()
    await expect(searchBoxV2.input).toHaveValue('')
  })

  test.describe('Category navigation', () => {
    test('Category navigation updates results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await comfyPage.canvasOps.doubleClick()
      await expect(searchBoxV2.input).toBeVisible()

      await searchBoxV2.categoryButton('sampling').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const samplingResults = await searchBoxV2.results.allTextContents()

      await searchBoxV2.categoryButton('loaders').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const loaderResults = await searchBoxV2.results.allTextContents()

      expect(samplingResults).not.toEqual(loaderResults)
    })
  })

  test.describe('Filter workflow', () => {
    test('Filter chip removal restores results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await comfyPage.canvasOps.doubleClick()
      await expect(searchBoxV2.input).toBeVisible()

      // Record initial result text for comparison
      await expect(searchBoxV2.results.first()).toBeVisible()
      const unfilteredResults = await searchBoxV2.results.allTextContents()

      // Apply Input filter with MODEL type
      await searchBoxV2.filterBarButton('Input').click()
      await expect(searchBoxV2.filterOptions.first()).toBeVisible()
      await searchBoxV2.input.fill('MODEL')
      await searchBoxV2.filterOptions
        .filter({ hasText: 'MODEL' })
        .first()
        .click()

      // Verify filter chip appeared and results changed
      const filterChip = searchBoxV2.dialog.locator(
        '[data-testid="filter-chip"]'
      )
      await expect(filterChip).toBeVisible()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const filteredResults = await searchBoxV2.results.allTextContents()
      expect(filteredResults).not.toEqual(unfilteredResults)

      // Remove filter by clicking the chip delete button
      await filterChip.getByTestId('chip-delete').click()

      // Filter chip should be removed
      await expect(filterChip).not.toBeVisible()
      await expect(searchBoxV2.results.first()).toBeVisible()
    })
  })

  test.describe('Keyboard navigation', () => {
    test('ArrowUp on first item keeps first selected', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await comfyPage.canvasOps.doubleClick()
      await expect(searchBoxV2.input).toBeVisible()

      await searchBoxV2.input.fill('KSampler')
      const results = searchBoxV2.results
      await expect(results.first()).toBeVisible()

      // First result should be selected by default
      await expect(results.first()).toHaveAttribute('aria-selected', 'true')

      // ArrowUp on first item should keep first selected
      await comfyPage.page.keyboard.press('ArrowUp')
      await expect(results.first()).toHaveAttribute('aria-selected', 'true')
    })
  })
})
