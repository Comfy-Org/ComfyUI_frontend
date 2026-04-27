import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Node search box V2', { tag: '@node' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.searchBoxV2.setup()
  })

  test('Can open search and add node', async ({ comfyPage }) => {
    const { searchBoxV2 } = comfyPage
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await searchBoxV2.open()
    await searchBoxV2.input.fill('KSampler')
    await expect(searchBoxV2.results.first()).toBeVisible()

    await comfyPage.page.keyboard.press('Enter')
    await expect(searchBoxV2.input).toBeHidden()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount + 1)
  })

  test('Can add first default result with Enter', async ({ comfyPage }) => {
    const { searchBoxV2 } = comfyPage
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

    await searchBoxV2.open()
    // Default results should be visible without typing.
    await expect(searchBoxV2.results.first()).toBeVisible()

    await comfyPage.page.keyboard.press('Enter')
    await expect(searchBoxV2.input).toBeHidden()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount + 1)
  })

  test.describe('Category navigation', () => {
    test('Bookmarked filter shows only bookmarked nodes', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await comfyPage.settings.setSetting('Comfy.NodeLibrary.Bookmarks.V2', [
        'KSampler'
      ])

      await searchBoxV2.open()
      await searchBoxV2.rootCategoryButton('favorites').click()

      await expect(searchBoxV2.results).toHaveCount(1)
      await expect(searchBoxV2.results.first()).toContainText('KSampler')
    })

    test('Category filters results to matching nodes', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()
      await searchBoxV2.categoryButton('sampling').click()

      await expect(searchBoxV2.results.first()).toBeVisible()
    })
  })

  test.describe('Filter workflow', () => {
    test('Can filter by input type via filter bar', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await test.step('Open Input filter popover', async () => {
        await searchBoxV2.typeFilterButton('input').click()
        await expect(searchBoxV2.filterOptions.first()).toBeVisible()
      })

      await test.step('Select MODEL type', async () => {
        await searchBoxV2.filterSearch.fill('MODEL')
        await searchBoxV2.filterOptions
          .filter({ hasText: 'MODEL' })
          .first()
          .click()
      })

      await expect(searchBoxV2.filterChips).toHaveCount(1)
      await expect(searchBoxV2.filterChips.first()).toContainText('MODEL')
      await expect(searchBoxV2.results.first()).toBeVisible()
    })
  })

  test.describe('Keyboard navigation', () => {
    test('Can navigate and select with keyboard', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await searchBoxV2.open()
      await searchBoxV2.input.fill('KSampler')
      const results = searchBoxV2.results
      await expect(results.first()).toBeVisible()

      await test.step('First result is selected by default', async () => {
        await expect(results.first()).toHaveAttribute('aria-selected', 'true')
      })

      await test.step('ArrowDown moves selection to next result', async () => {
        await comfyPage.page.keyboard.press('ArrowDown')
        await expect(results.nth(1)).toHaveAttribute('aria-selected', 'true')
        await expect(results.first()).toHaveAttribute('aria-selected', 'false')
      })

      await test.step('ArrowUp moves selection back', async () => {
        await comfyPage.page.keyboard.press('ArrowUp')
        await expect(results.first()).toHaveAttribute('aria-selected', 'true')
      })

      await test.step('Enter selects and adds the node', async () => {
        await comfyPage.page.keyboard.press('Enter')
        await expect(searchBoxV2.input).toBeHidden()
        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(initialCount + 1)
      })
    })
  })
})
