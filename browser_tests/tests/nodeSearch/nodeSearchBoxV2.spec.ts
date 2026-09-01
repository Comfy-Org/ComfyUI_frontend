import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { RootCategory } from '@/components/searchbox/v2/rootCategories'

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
    await expect(searchBoxV2.results.first()).toBeVisible()

    await comfyPage.page.keyboard.press('Enter')
    await expect(searchBoxV2.input).toBeHidden()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount + 1)
  })

  test('Double-click on empty canvas opens search', async ({ comfyPage }) => {
    const { searchBoxV2 } = comfyPage

    await searchBoxV2.openByDoubleClickCanvas()
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

  for (const closeKey of ['Enter', 'Escape'] as const) {
    test(`Reopening search after ${closeKey} has no persisted state`, async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()
      await searchBoxV2.input.fill('KSampler')
      await expect(searchBoxV2.results.first()).toBeVisible()
      await comfyPage.page.keyboard.press(closeKey)
      await expect(searchBoxV2.input).toBeHidden()

      await searchBoxV2.open()
      await expect(searchBoxV2.input).toHaveValue('')
      await expect(searchBoxV2.filterChips).toHaveCount(0)
    })
  }

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

    test('Category navigation updates results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.categoryButton('model').click()
      await searchBoxV2.categoryButton('model/sampling').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const samplingResults = await searchBoxV2.results.allTextContents()

      await searchBoxV2.categoryButton('model/loaders').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      await expect
        .poll(() => searchBoxV2.results.allTextContents())
        .not.toEqual(samplingResults)
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

    test('Filter chip removal restores results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.input.fill('Load')
      await expect(searchBoxV2.results.first()).toBeVisible()
      const unfilteredCount = await searchBoxV2.results.count()

      await test.step('Apply Input/MODEL filter', async () => {
        await searchBoxV2.applyTypeFilter('input', 'MODEL')
        await expect(searchBoxV2.filterChips).toHaveCount(1)
        await expect
          .poll(() => searchBoxV2.results.count())
          .not.toBe(unfilteredCount)
      })

      await test.step('Remove the filter chip', async () => {
        await searchBoxV2.removeFilterChip()
        await expect(searchBoxV2.filterChips).toHaveCount(0)
        await expect(searchBoxV2.results).toHaveCount(unfilteredCount)
      })
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

      const modelCategory = searchBoxV2.categoryButton('model')
      await expect(modelCategory).toBeVisible()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )

      await searchBoxV2.sidebarToggle.click()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await expect(modelCategory).toBeHidden()

      await searchBoxV2.sidebarToggle.click()
      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'true'
      )
      await expect(modelCategory).toBeVisible()
    })

    test('Filter bar scrolls horizontally while the sidebar toggle stays pinned', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
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
      await expect(searchBoxV2.categoryButton('model')).toBeHidden()
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
      await expect(searchBoxV2.categoryButton('model')).toBeVisible()
      await expect(searchBoxV2.sidebarBackdrop).toBeVisible()

      await searchBoxV2.sidebarBackdrop.click({ position: { x: 240, y: 40 } })

      await expect(searchBoxV2.sidebarToggle).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await expect(searchBoxV2.categoryButton('model')).toBeHidden()
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

    test('Sidebar state across mobile/desktop resizes', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage
      const switchToDesktop = () =>
        comfyPage.page.setViewportSize({ width: 1280, height: 800 })
      const switchToMobile = () =>
        comfyPage.page.setViewportSize({ width: 360, height: 800 })
      const expectExpanded = (value: 'true' | 'false') =>
        expect(searchBoxV2.sidebarToggle).toHaveAttribute(
          'aria-expanded',
          value
        )

      await switchToDesktop()
      await searchBoxV2.open()
      await expectExpanded('true')

      await switchToMobile()
      await expectExpanded('false')

      await searchBoxV2.sidebarToggle.click()
      await switchToDesktop()
      await expectExpanded('true')

      await searchBoxV2.sidebarToggle.click()
      await switchToMobile()
      await expectExpanded('false')

      await switchToDesktop()
      await expectExpanded('false')
    })

    test('Category tree expand and collapse', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.categoryButton('model').click()
      const samplingBtn = searchBoxV2.categoryButton('model/sampling')
      const subcategory = searchBoxV2.categoryButton('model/sampling/custom')

      await test.step('Expanding sampling reveals its subcategories', async () => {
        await samplingBtn.click()
        await expect(subcategory).toBeVisible()
      })

      await test.step('Collapsing sampling hides its subcategories', async () => {
        await samplingBtn.click()
        await expect(subcategory).toBeHidden()
      })
    })

    test('Subcategory narrows results to subset', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.categoryButton('model').click()
      await searchBoxV2.categoryButton('model/sampling').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const parentCount = await searchBoxV2.results.count()

      const subcategory = searchBoxV2.categoryButton('model/sampling/custom')
      await expect(subcategory).toBeVisible()
      await subcategory.click()

      await expect
        .poll(() => searchBoxV2.results.count())
        .toBeLessThan(parentCount)
    })

    test('Most relevant resets category filter', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const defaultCount = await searchBoxV2.results.count()

      await searchBoxV2.categoryButton('model').click()
      await searchBoxV2.categoryButton('model/sampling').click()
      await expect
        .poll(() => searchBoxV2.results.count())
        .not.toBe(defaultCount)

      await searchBoxV2.categoryButton('most-relevant').click()
      await expect(searchBoxV2.results).toHaveCount(defaultCount)
    })

    test(
      'Blueprint root chip filters to published blueprints',
      { tag: ['@subgraph'] },
      async ({ comfyPage }) => {
        const blueprintName = `chip-test-${crypto.randomUUID().slice(0, 8)}`
        const nodeRef = await comfyPage.nodeOps.getNodeRefById('3')
        await nodeRef.click('title')
        await comfyPage.command.executeCommand('Comfy.Graph.ConvertToSubgraph')
        await expect
          .poll(() =>
            comfyPage.nodeOps
              .getNodeRefsByTitle('New Subgraph')
              .then((refs) => refs.length)
          )
          .toBe(1)
        const subgraphNodes =
          await comfyPage.nodeOps.getNodeRefsByTitle('New Subgraph')
        await subgraphNodes[0].click('title')
        await comfyPage.command.executeCommand('Comfy.PublishSubgraph', {
          name: blueprintName
        })
        await expect(comfyPage.visibleToasts).toHaveCount(1, { timeout: 5000 })
        await comfyPage.toast.closeToasts(1)

        const { searchBoxV2 } = comfyPage
        await searchBoxV2.open()

        const blueprintsChip = searchBoxV2.rootCategoryButton(
          RootCategory.Blueprint
        )
        await expect(blueprintsChip).toBeVisible()
        await blueprintsChip.click()

        await expect(
          searchBoxV2.results.filter({ hasText: blueprintName })
        ).toHaveCount(1)
      }
    )
  })

  test.describe('Link release', () => {
    test('Link release opens search with pre-applied type filter', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await comfyPage.canvasOps.disconnectEdge()
      await expect(searchBoxV2.input).toBeVisible()

      await expect(searchBoxV2.filterChips).toHaveCount(1)
      await expect(searchBoxV2.filterChips.first()).toContainText('CLIP')
    })

    test('Link release auto-connects added node', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const NODE_TYPE = 'CLIPTextEncode'
      const refsBefore = await comfyPage.nodeOps.getNodeRefsByType(NODE_TYPE)
      const idsBefore = new Set(refsBefore.map((n) => n.id))

      await comfyPage.canvasOps.disconnectEdge()
      await expect(searchBoxV2.input).toBeVisible()

      await searchBoxV2.input.fill('CLIP Text Encode')
      await expect(searchBoxV2.results.first()).toBeVisible()
      await comfyPage.page.keyboard.press('Enter')
      await expect(searchBoxV2.input).toBeHidden()

      await expect
        .poll(() =>
          comfyPage.nodeOps
            .getNodeRefsByType(NODE_TYPE)
            .then((refs) => refs.length)
        )
        .toBe(refsBefore.length + 1)

      const refsAfter = await comfyPage.nodeOps.getNodeRefsByType(NODE_TYPE)
      const newNode = refsAfter.find((n) => !idsBefore.has(n.id))
      expect(newNode, 'expected a new CLIPTextEncode node').toBeDefined()
      const clipInput = await newNode!.getInput(0)
      await expect.poll(() => clipInput.getLinkCount()).toBe(1)
    })
  })

  test.describe('Filter combinations', () => {
    test('Output type filter filters results', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.input.fill('Load')
      await expect(searchBoxV2.results.first()).toBeVisible()
      const unfilteredCount = await searchBoxV2.results.count()

      await searchBoxV2.applyTypeFilter('output', 'IMAGE')
      await expect(searchBoxV2.filterChips).toHaveCount(1)
      await expect
        .poll(() => searchBoxV2.results.count())
        .not.toBe(unfilteredCount)
    })

    test('Multiple type filters (Input + Output) narrows results', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.applyTypeFilter('input', 'MODEL')
      await expect(searchBoxV2.filterChips).toHaveCount(1)
      await expect(searchBoxV2.results.first()).toBeVisible()
      const singleFilterCount = await searchBoxV2.results.count()

      await searchBoxV2.applyTypeFilter('output', 'LATENT')
      await expect(searchBoxV2.filterChips).toHaveCount(2)
      await expect
        .poll(() => searchBoxV2.results.count())
        .toBeLessThan(singleFilterCount)
    })

    test('Root filter + search query narrows results', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()
      await searchBoxV2.input.fill('Sampler')
      await expect(searchBoxV2.results.first()).toBeVisible()
      const unfilteredCount = await searchBoxV2.results.count()

      await searchBoxV2.rootCategoryButton('comfy').click()
      await expect
        .poll(() => searchBoxV2.results.count())
        .toBeLessThan(unfilteredCount)
      await expect.poll(() => searchBoxV2.results.count()).toBeGreaterThan(0)
    })

    test('Root filter + category selection', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      await searchBoxV2.rootCategoryButton('comfy').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const comfyCount = await searchBoxV2.results.count()

      await searchBoxV2.categoryButton('comfy/model').click()
      await expect
        .poll(() => searchBoxV2.results.count())
        .toBeLessThan(comfyCount)
    })
  })

  test.describe('Search behavior', () => {
    test('Search narrows results progressively', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const getCount = () => searchBoxV2.results.count()

      await searchBoxV2.open()

      await searchBoxV2.input.fill('Sam')
      await expect(searchBoxV2.results.first()).toBeVisible()
      const count1 = await getCount()

      await searchBoxV2.input.fill('Sampl')
      await expect.poll(getCount).toBeLessThan(count1)
      const count2 = await getCount()

      await searchBoxV2.input.fill('Sampler')
      await expect.poll(getCount).toBeLessThan(count2)
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
      await searchBoxV2.applyTypeFilter('input', 'MODEL')
      await searchBoxV2.applyTypeFilter('output', 'LATENT')

      await expect(searchBoxV2.filterChips).toHaveCount(2)
      const chipTexts = await searchBoxV2.filterChips.allTextContents()
      expect(chipTexts.some((t) => t.includes('MODEL'))).toBe(true)
      expect(chipTexts.some((t) => t.includes('LATENT'))).toBe(true)
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

      await expect(searchBoxV2.nodeIdBadge.first()).toBeVisible()
      await expect(searchBoxV2.nodeIdBadge.first()).toContainText('VAEDecode')
    })

    test('Follow-cursor disabled places node without ghost mode', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.NodeSearchBoxImpl.FollowCursor',
        false
      )
      const { searchBoxV2 } = comfyPage
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()

      await searchBoxV2.open()

      await searchBoxV2.input.fill('KSampler')
      await expect(searchBoxV2.results.first()).toBeVisible()

      await searchBoxV2.results.first().click()
      await expect(searchBoxV2.input).toBeHidden()

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)

      await expect(
        comfyPage.page.locator('[data-node-id][data-ghost]')
      ).toHaveCount(0)
    })
  })
})
