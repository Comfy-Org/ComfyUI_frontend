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

  test.describe('Category sidebar', () => {
    test('Sidebar toggle hides and shows the category sidebar', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await searchBoxV2.open()

      const samplingCategory = searchBoxV2.categoryButton('sampling')
      await expect(samplingCategory).toBeVisible()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )

      await searchBoxV2.sidebarToggle.click()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await expect(samplingCategory).toBeHidden()

      await searchBoxV2.sidebarToggle.click()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await expect(samplingCategory).toBeVisible()
    })

    test('Filter bar scrolls horizontally while the sidebar toggle stays pinned', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      // Narrow viewport so the chips overflow the filter bar
      await comfyPage.page.setViewportSize({ width: 360, height: 800 })
      await searchBoxV2.open()

      const scrollEl = searchBoxV2.filterChipsScroll
      const dims = await scrollEl.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth
      }))
      expect(dims.scrollWidth).toBeGreaterThan(dims.clientWidth)

      await scrollEl.evaluate((el) => {
        el.scrollLeft = el.scrollWidth
      })

      // The toggle lives outside the scroll container, so even when the
      // chips scroll hundreds of px it must remain visible in the viewport.
      await expect(searchBoxV2.sidebarToggle).toBeInViewport()
    })

    test('@mobile Sidebar is collapsed by default on mobile', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await searchBoxV2.open()

      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await expect(searchBoxV2.categoryButton('sampling')).toBeHidden()
    })

    test('@mobile Clicking outside the sidebar closes it', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await searchBoxV2.open()

      await searchBoxV2.sidebarToggle.click()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await expect(searchBoxV2.categoryButton('sampling')).toBeVisible()
      await expect(searchBoxV2.sidebarBackdrop).toBeVisible()

      // The backdrop spans the full content area, but the sidebar (z-20)
      // covers its left ~208px (w-52). Click past that to land on the
      // backdrop rather than the sidebar.
      await searchBoxV2.sidebarBackdrop.click({ position: { x: 240, y: 40 } })

      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await expect(searchBoxV2.categoryButton('sampling')).toBeHidden()
      await expect(searchBoxV2.sidebarBackdrop).toBeHidden()
    })

    test('@mobile Focusing the search input closes the sidebar', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await searchBoxV2.open()

      await searchBoxV2.sidebarToggle.click()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )

      await searchBoxV2.input.focus()

      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    })

    test('Sidebar collapses on resize to mobile and preserves user state on resize to desktop', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      await comfyPage.page.setViewportSize({ width: 1280, height: 800 })
      await searchBoxV2.open()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )

      await comfyPage.page.setViewportSize({ width: 360, height: 800 })
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )

      // Returning to desktop must NOT auto-restore the sidebar — the
      // user's collapsed state is preserved across breakpoint changes.
      await comfyPage.page.setViewportSize({ width: 1280, height: 800 })
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    })
  })
})
