import { DefaultGraphPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { RootCategory } from '@/components/searchbox/v2/rootCategories'

test.describe('Node search box V2 extended', { tag: '@node' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.searchBoxV2.setup()
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

      // Verify the auto-connect: the newly-added node's CLIP input must be
      // connected (proves the release wasn't just dropped).
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

      // Under root filter, categories are prefixed (e.g. comfy/model).
      await searchBoxV2.categoryButton('comfy/model').click()
      await expect
        .poll(() => searchBoxV2.results.count())
        .toBeLessThan(comfyCount)
    })
  })

  test.describe('Category sidebar', () => {
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

        // Blueprints persist across tests on the same worker; filter by the
        // unique name we just published rather than asserting the full list.
        await expect(
          searchBoxV2.results.filter({ hasText: blueprintName })
        ).toHaveCount(1)
      }
    )
  })

  test.describe('Search behavior', () => {
    test('Search narrows results progressively', async ({ comfyPage }) => {
      const { searchBoxV2 } = comfyPage
      const getCount = () => searchBoxV2.results.count()

      await searchBoxV2.open()

      // The result list caps at 64, so a one- or two-letter query saturates it
      // and narrowing is invisible. Start below the cap.
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

  test.describe('Nested dynamic input types', () => {
    test('Input filter surfaces a type nested in a DynamicCombo option', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()
      await searchBoxV2.input.fill('Dynamic Combo')
      await expect(searchBoxV2.results.first()).toBeVisible()

      await searchBoxV2.applyTypeFilter('input', 'IMAGE')

      await expect(
        searchBoxV2.results.filter({ hasText: 'Node With Dynamic Combo' })
      ).toHaveCount(1)
    })

    test('Input filter surfaces a type nested three levels deep', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await searchBoxV2.open()
      await searchBoxV2.input.fill('Dynamic Combo')
      await expect(searchBoxV2.results.first()).toBeVisible()

      await searchBoxV2.applyTypeFilter('input', 'MASK')

      await expect(
        searchBoxV2.results.filter({ hasText: 'Node With Dynamic Combo' })
      ).toHaveCount(1)
    })

    for (const side of ['input', 'output'] as const) {
      test(`Dynamic control wrappers are not offered as ${side} filter values`, async ({
        comfyPage
      }) => {
        const { searchBoxV2 } = comfyPage

        await searchBoxV2.open()
        await searchBoxV2.typeFilterButton(side).click()
        await searchBoxV2.filterOptions.first().waitFor({ state: 'visible' })

        const offered = await searchBoxV2.filterOptions.allTextContents()
        expect(offered.length).toBeGreaterThan(0)
        expect(offered.filter((t) => /COMFY_\w+_V3/.test(t))).toEqual([])
      })
    }

    /** Drag the default graph's existing IMAGE link (VAE Decode -> Save Image)
     * off its input and release it on empty canvas. */
    async function releaseImageLinkOnCanvas(comfyPage: ComfyPage) {
      // The default graph is wider than the viewport; fit it so the Save Image
      // input is actually on screen before dragging from it.
      await fitToViewInstant(comfyPage)

      const saveImage = (
        await comfyPage.nodeOps.getNodeRefsByTitle('Save Image')
      )[0]
      const imageInput = await saveImage.getInput(0)

      await comfyPage.canvasOps.dragAndDrop(
        await imageInput.getPosition(),
        DefaultGraphPositions.emptySpace
      )
    }

    /** Whether the node has a connected socket of `type`, whatever its index. */
    async function hasConnectedInputOfType(
      node: Awaited<ReturnType<typeof dynamicComboNode>>,
      type: string
    ) {
      const inputs =
        await node.getProperty<{ type: string; link: number | null }[]>(
          'inputs'
        )
      return inputs.some((input) => input.type === type && input.link != null)
    }

    async function dynamicComboNode(comfyPage: ComfyPage) {
      const [node] = await comfyPage.nodeOps.getNodeRefsByType(
        'DevToolsNodeWithDynamicCombo'
      )
      return node
    }

    test('Link release via the search box connects through a combo option', async ({
      comfyPage
    }) => {
      const { searchBoxV2 } = comfyPage

      await releaseImageLinkOnCanvas(comfyPage)

      await expect(searchBoxV2.dialog).toBeVisible()
      await searchBoxV2.input.fill('Dynamic Combo')
      await expect(searchBoxV2.results.first()).toBeVisible()
      await searchBoxV2.results.first().click()
      await expect(searchBoxV2.dialog).toBeHidden()

      const target = await dynamicComboNode(comfyPage)
      const combo = await target.getWidgetByName('combo')

      // IMAGE lives under option3, which is not the default selection, so the
      // node only has an IMAGE socket if the reveal ran.
      expect(await combo.getValue()).toBe('option3')
      expect(await hasConnectedInputOfType(target, 'IMAGE')).toBe(true)
    })
  })
})
