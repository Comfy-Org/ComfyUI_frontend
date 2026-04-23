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

  test('Reopening search after Enter has no persisted state', async ({
    comfyPage
  }) => {
    const { searchBoxV2 } = comfyPage

    await searchBoxV2.open()
    await searchBoxV2.input.fill('KSampler')
    await expect(searchBoxV2.results.first()).toBeVisible()
    await comfyPage.page.keyboard.press('Enter')
    await expect(searchBoxV2.input).toBeHidden()

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

      // Search first to keep the result set under the 64-item cap.
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

  test.describe('Link release', () => {
    test('Link release opens search with pre-applied type filter', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await comfyPage.canvasOps.disconnectEdge()
      await expect(searchBoxV2.input).toBeVisible()

      // disconnectEdge pulls a CLIP link → expect a single CLIP filter chip.
      await expect(searchBoxV2.filterChips).toHaveCount(1)
      await expect(searchBoxV2.filterChips.first()).toContainText('CLIP')
    })

    test('Link release auto-connects added node', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const NODE_TYPE = 'CLIPTextEncode'
      const refsBefore = await comfyPage.nodeOps.getNodeRefsByType(NODE_TYPE)
      const idsBefore = new Set(refsBefore.map((n) => n.id))
      const linkCountBefore = await comfyPage.nodeOps.getLinkCount()

      await comfyPage.canvasOps.disconnectEdge()
      await expect(searchBoxV2.input).toBeVisible()

      await searchBoxV2.input.fill('CLIP Text Encode')
      await expect(searchBoxV2.results.first()).toBeVisible()
      await comfyPage.page.keyboard.press('Enter')
      await expect(searchBoxV2.input).toBeHidden()

      // A new CLIPTextEncode node should have been added.
      await expect
        .poll(() =>
          comfyPage.nodeOps
            .getNodeRefsByType(NODE_TYPE)
            .then((refs) => refs.length)
        )
        .toBe(refsBefore.length + 1)

      // Net link count is unchanged: original release dropped a link, the
      // selected node re-attached one.
      await expect
        .poll(() => comfyPage.nodeOps.getLinkCount())
        .toBe(linkCountBefore)

      // Verify the auto-connect: the newly-added node's CLIP input must be
      // connected (proves the release wasn't just dropped).
      const refsAfter = await comfyPage.nodeOps.getNodeRefsByType(NODE_TYPE)
      const newNode = refsAfter.find((n) => !idsBefore.has(n.id))
      if (!newNode) throw new Error('Expected a new CLIPTextEncode node')
      const clipInput = await newNode.getInput(0)
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

      // Under root filter, categories are prefixed (e.g. comfy/sampling).
      await searchBoxV2.categoryButton('comfy/sampling').click()
      await expect
        .poll(() => searchBoxV2.results.count())
        .toBeLessThan(comfyCount)
    })
  })

  test.describe('Category sidebar', () => {
    test('Category tree expand and collapse', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()

      const samplingBtn = searchBoxV2.categoryButton('sampling')
      const subcategory = searchBoxV2.categoryButton('sampling/custom_sampling')

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

      await searchBoxV2.categoryButton('sampling').click()
      await expect(searchBoxV2.results.first()).toBeVisible()
      const parentCount = await searchBoxV2.results.count()

      const subcategory = searchBoxV2.categoryButton('sampling/custom_sampling')
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

      await searchBoxV2.categoryButton('sampling').click()
      await expect
        .poll(() => searchBoxV2.results.count())
        .not.toBe(defaultCount)

      await searchBoxV2.categoryButton('most-relevant').click()
      await expect(searchBoxV2.results).toHaveCount(defaultCount)
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
      await expect(searchBoxV2.input).toBeHidden()
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount())
        .toBe(initialCount + 1)
    })

    test('Search narrows results progressively', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const getCount = () => searchBoxV2.results.count()

      await searchBoxV2.open()

      await searchBoxV2.input.fill('S')
      await expect(searchBoxV2.results.first()).toBeVisible()
      const count1 = await getCount()

      await searchBoxV2.input.fill('Sa')
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

      await expect(searchBoxV2.nodeIdBadge.first()).toBeVisible()
      await expect(searchBoxV2.nodeIdBadge.first()).toContainText('VAEDecode')
    })
  })
})
