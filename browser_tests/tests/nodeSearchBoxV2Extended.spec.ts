import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Node search box V2 extended', { tag: '@node' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.searchBoxV2.enableV2Search()
    await comfyPage.settings.setSetting(
      'Comfy.LinkRelease.Action',
      'search box'
    )
    await comfyPage.settings.setSetting(
      'Comfy.LinkRelease.ActionShift',
      'search box'
    )
  })

  test('Double-click on empty canvas opens search', async ({ comfyPage }) => {
    const { searchBoxV2 } = comfyPage

    await comfyPage.page.mouse.dblclick(200, 200, { delay: 5 })
    await expect(searchBoxV2.input).toBeVisible()
    await expect(searchBoxV2.dialog).toBeVisible()
  })

  test('Escape closes search box without adding node', async ({
    comfyPage
  }) => {
    const { searchBoxV2 } = comfyPage
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await searchBoxV2.open()

    await searchBoxV2.input.fill('KSampler')
    await expect(searchBoxV2.results.first()).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(searchBoxV2.input).toBeHidden()

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount)
  })

  test('Reopening search after Enter has no persisted state', async ({
    comfyPage
  }) => {
    const { searchBoxV2 } = comfyPage

    await searchBoxV2.open()
    await searchBoxV2.input.fill('KSampler')
    await expect(searchBoxV2.results.first()).toBeVisible()
    await comfyPage.page.keyboard.press('Enter')
    await expect(searchBoxV2.input).not.toBeVisible()

    await searchBoxV2.open()
    await expect(searchBoxV2.input).toHaveValue('')
    await expect(searchBoxV2.filterChips).toHaveCount(0)
  })

  test('Reopening search after Escape has no persisted state', async ({
    comfyPage
  }) => {
    const { searchBoxV2 } = comfyPage

    await searchBoxV2.open()
    await searchBoxV2.input.fill('KSampler')
    await expect(searchBoxV2.results.first()).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(searchBoxV2.input).toBeHidden()

    await searchBoxV2.open()
    await expect(searchBoxV2.input).toHaveValue('')
    await expect(searchBoxV2.filterChips).toHaveCount(0)
  })

  test.describe('Category navigation', () => {
    test('Category navigation updates results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.categoryButton('sampling').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const samplingResults = await searchBoxV2.results.allTextContents()

      await searchBoxV2.categoryButton('loaders').click()
      await expect(searchBoxV2.results.first()).toBeVisible()

      await expect
        .poll(() => searchBoxV2.results.allTextContents())
        .not.toEqual(samplingResults)
    })
  })

  test.describe('Filter workflow', () => {
    test('Filter chip removal restores results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      // Search first to get a result set below the 64-item cap
      await searchBoxV2.input.fill('Load')
      const unfilteredCount = await searchBoxV2.getResultCount()

      // Apply Input filter with MODEL type
      await searchBoxV2.applyTypeFilter('Input', 'MODEL')
      await expect(searchBoxV2.filterChips.first()).toBeVisible()
      const filteredCount = await searchBoxV2.getResultCount()
      expect(filteredCount).not.toBe(unfilteredCount)

      // Remove filter by clicking the chip delete button
      await searchBoxV2.removeFilterChip()

      // Filter chip should be removed and count restored
      await expect(searchBoxV2.filterChips).toHaveCount(0)
      const restoredCount = await searchBoxV2.getResultCount()
      expect(restoredCount).toBe(unfilteredCount)
    })
  })

  test.describe('Link release', () => {
    test('Link release opens search with pre-applied type filter', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await comfyPage.canvasOps.disconnectEdge()
      await expect(searchBoxV2.input).toBeVisible()

      // disconnectEdge pulls a CLIP link - should have a filter chip
      await expect(searchBoxV2.filterChips).toHaveCount(1)
      await expect(searchBoxV2.filterChips.first()).toContainText('CLIP')
    })

    test('Link release auto-connects added node', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const nodeCountBefore = await comfyPage.nodeOps.getGraphNodesCount()
      const linkCountBefore = await comfyPage.nodeOps.getLinkCount()

      await comfyPage.canvasOps.disconnectEdge()
      await expect(searchBoxV2.input).toBeVisible()

      // Search for a node that accepts CLIP input and select it
      await searchBoxV2.input.fill('CLIP Text Encode')
      await expect(searchBoxV2.results.first()).toBeVisible()
      await comfyPage.page.keyboard.press('Enter')
      await expect(searchBoxV2.input).not.toBeVisible()

      // A new node should have been added and auto-connected
      const nodeCountAfter = await comfyPage.nodeOps.getGraphNodesCount()
      expect(nodeCountAfter).toBe(nodeCountBefore + 1)

      const linkCountAfter = await comfyPage.nodeOps.getLinkCount()
      expect(linkCountAfter).toBe(linkCountBefore)
    })
  })

  test.describe('Filter combinations', () => {
    test('Output type filter filters results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      // Search first so both counts use the search service path
      await searchBoxV2.input.fill('Load')
      const unfilteredCount = await searchBoxV2.getResultCount()

      await searchBoxV2.applyTypeFilter('Output', 'IMAGE')
      await expect(searchBoxV2.filterChips).toHaveCount(1)
      const filteredCount = await searchBoxV2.getResultCount()

      expect(filteredCount).not.toBe(unfilteredCount)
    })

    test('Multiple type filters (Input + Output) narrows results', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.applyTypeFilter('Input', 'MODEL')
      await expect(searchBoxV2.filterChips).toHaveCount(1)
      const singleFilterCount = await searchBoxV2.getResultCount()

      await searchBoxV2.applyTypeFilter('Output', 'LATENT')
      await expect(searchBoxV2.filterChips).toHaveCount(2)
      const dualFilterCount = await searchBoxV2.getResultCount()

      expect(dualFilterCount).toBeLessThan(singleFilterCount)
    })

    test('Root filter + search query narrows results', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      // Search without root filter
      await searchBoxV2.input.fill('Sampler')
      const unfilteredCount = await searchBoxV2.getResultCount()

      // Apply Comfy root filter on top of search
      await searchBoxV2.filterBarButton('Comfy').click()
      const filteredCount = await searchBoxV2.getResultCount()

      // Root filter should narrow or maintain the result set
      expect(filteredCount).toBeLessThan(unfilteredCount)
      expect(filteredCount).toBeGreaterThan(0)
    })

    test('Root filter + category selection', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      // Click "Comfy" root filter
      await searchBoxV2.filterBarButton('Comfy').click()
      const comfyCount = await searchBoxV2.getResultCount()

      // Under root filter, categories are prefixed (e.g. comfy/sampling)
      await searchBoxV2.categoryButton('comfy/sampling').click()
      const comfySamplingCount = await searchBoxV2.getResultCount()

      expect(comfySamplingCount).toBeLessThan(comfyCount)
    })
  })

  test.describe('Category sidebar', () => {
    test('Category tree expand and collapse', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      // Click a parent category to expand it
      const samplingBtn = searchBoxV2.categoryButton('sampling')
      await samplingBtn.click()

      // Look for subcategories (e.g. sampling/custom_sampling)
      const subcategory = searchBoxV2.categoryButton('sampling/custom_sampling')
      await expect(subcategory).toBeVisible()

      // Click sampling again to collapse
      await samplingBtn.click()
      await expect(subcategory).not.toBeVisible()
    })

    test('Subcategory narrows results to subset', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      // Select parent category
      await searchBoxV2.categoryButton('sampling').click()
      const parentCount = await searchBoxV2.getResultCount()

      // Select subcategory
      const subcategory = searchBoxV2.categoryButton('sampling/custom_sampling')
      await expect(subcategory).toBeVisible()
      await subcategory.click()
      const childCount = await searchBoxV2.getResultCount()

      expect(childCount).toBeLessThan(parentCount)
    })

    test('Most relevant resets category filter', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()
      const defaultCount = await searchBoxV2.getResultCount()

      // Select a category
      await searchBoxV2.categoryButton('sampling').click()
      const samplingCount = await searchBoxV2.getResultCount()
      expect(samplingCount).not.toBe(defaultCount)

      // Click "Most relevant" to reset
      await searchBoxV2.categoryButton('most-relevant').click()
      const resetCount = await searchBoxV2.getResultCount()
      expect(resetCount).toBe(defaultCount)
    })
  })

  test.describe('Search behavior', () => {
    test('Click on result item adds node', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await searchBoxV2.open()

      await searchBoxV2.input.fill('KSampler')
      await expect(searchBoxV2.results.first()).toBeVisible()

      await searchBoxV2.results.first().click()
      await expect(searchBoxV2.input).not.toBeVisible()

      const newCount = await comfyPage.nodeOps.getGraphNodesCount()
      expect(newCount).toBe(initialCount + 1)
    })

    test('Search narrows results progressively', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.input.fill('S')
      const count1 = await searchBoxV2.getResultCount()

      await searchBoxV2.input.fill('Sa')
      const count2 = await searchBoxV2.getResultCount()

      await searchBoxV2.input.fill('Sampler')
      const count3 = await searchBoxV2.getResultCount()

      expect(count2).toBeLessThan(count1)
      expect(count3).toBeLessThan(count2)
    })

    test('No results shown for nonsensical query', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.input.fill('zzzxxxyyy_nonexistent_node')
      await expect(searchBoxV2.noResults).toBeVisible()
      await expect(searchBoxV2.results).toHaveCount(0)
    })
  })

  test.describe('Filter chip interaction', () => {
    test('Multiple filter chips displayed', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.applyTypeFilter('Input', 'MODEL')
      await searchBoxV2.applyTypeFilter('Output', 'LATENT')

      await expect(searchBoxV2.filterChips).toHaveCount(2)
      await expect(searchBoxV2.filterChips.first()).toContainText('MODEL')
      await expect(searchBoxV2.filterChips.nth(1)).toContainText('LATENT')
    })
  })

  test.describe('Settings-driven behavior', () => {
    test('Node ID name shown when setting enabled', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.NodeSearchBoxImpl.ShowIdName',
        true
      )
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.input.fill('VAE Decode')
      await expect(searchBoxV2.results.first()).toBeVisible()

      const firstResult = searchBoxV2.results.first()
      const idBadge = firstResult.getByTestId('node-id-badge')
      await expect(idBadge).toBeVisible()
      await expect(idBadge).toContainText('VAEDecode')
    })
  })
})
