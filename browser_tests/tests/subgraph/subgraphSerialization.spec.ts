import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect, comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import type { PromotedWidgetEntry } from '@e2e/fixtures/utils/promotedWidgets'
import {
  getPromotedWidgetCount,
  getPromotedWidgetNames,
  getPromotedWidgets
} from '@e2e/fixtures/utils/promotedWidgets'

const DUPLICATE_IDS_WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'
const LEGACY_PREFIXED_WORKFLOW =
  'subgraphs/nested-subgraph-legacy-prefixed-proxy-widgets'
const LEGACY_THREE_TUPLE_WORKFLOW = 'subgraphs/nested-duplicate-widget-names'
const MULTI_INSTANCE_WORKFLOW =
  'subgraphs/subgraph-multi-instance-promoted-text-values'

async function getPromotedHostWidgetValues(
  comfyPage: ComfyPage,
  nodeIds: string[]
) {
  return comfyPage.page.evaluate((ids) => {
    const graph = window.app!.canvas.graph!

    return ids.map((id) => {
      const node = graph.getNodeById(id)
      if (!node?.isSubgraphNode()) {
        return { id, values: [] as unknown[] }
      }

      return {
        id,
        values: (node.widgets ?? []).map((widget) => widget.value)
      }
    })
  }, nodeIds)
}

async function expectPromotedWidgetsToResolveToInteriorNodes(
  comfyPage: ComfyPage,
  hostSubgraphNodeId: string,
  widgets: PromotedWidgetEntry[]
) {
  expect(widgets.length).toBeGreaterThan(0)

  const interiorNodeIds = widgets.map(([id]) => id)
  const results = await comfyPage.page.evaluate(
    ([hostId, ids]) => {
      const graph = window.app!.graph!
      const hostNode = graph.getNodeById(Number(hostId))
      if (!hostNode?.isSubgraphNode()) return ids.map(() => false)

      return ids.map((id) => {
        const interiorNode = hostNode.subgraph.getNodeById(Number(id))
        return interiorNode !== null && interiorNode !== undefined
      })
    },
    [hostSubgraphNodeId, interiorNodeIds] as const
  )

  expect(results).toEqual(widgets.map(() => true))
}

test.describe('Subgraph Serialization', { tag: ['@subgraph'] }, () => {
  test('Promoted widget remains usable after serialize and reload', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-with-promoted-text-widget'
    )

    const beforeReload = comfyPage.page.locator('.comfy-multiline-input')
    await expect(beforeReload).toHaveCount(1)
    await expect(beforeReload).toBeVisible()

    await comfyPage.subgraph.serializeAndReload()

    const afterReload = comfyPage.page.locator('.comfy-multiline-input')
    await expect(afterReload).toHaveCount(1)
    await expect(afterReload).toBeVisible()
  })

  test('Compressed target_slot workflow boots into a usable promoted widget state', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-compressed-target-slot'
    )

    await expect
      .poll(async () => {
        const widgets = await getPromotedWidgets(comfyPage, '2')
        return widgets.some(([, widgetName]) => widgetName === 'batch_size')
      })
      .toBe(true)
  })

  test('Duplicate ID remap workflow remains navigable after a full reload boot path', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

    await comfyPage.page.reload()
    await comfyPage.page.waitForFunction(() => !!window.app)
    await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

    const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
    await subgraphNode.navigateIntoSubgraph()

    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

    await comfyPage.keyboard.press('Escape')

    await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
  })

  test.describe('Deterministic proxyWidgets Hydrate', () => {
    test('proxyWidgets entries map to real interior node IDs after load', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const widgets = await getPromotedWidgets(comfyPage, '11')
      expect(widgets.length).toBeGreaterThan(0)

      for (const [interiorNodeId] of widgets) {
        expect(Number(interiorNodeId)).toBeGreaterThan(0)
      }

      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        widgets
      )
    })

    test('proxyWidgets entries survive double round-trip without drift', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-widgets'
      )

      const initialWidgets = await getPromotedWidgets(comfyPage, '11')
      expect(initialWidgets.length).toBeGreaterThan(0)
      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        initialWidgets
      )

      await comfyPage.subgraph.serializeAndReload()

      const afterFirst = await getPromotedWidgets(comfyPage, '11')
      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        afterFirst
      )

      await comfyPage.subgraph.serializeAndReload()

      const afterSecond = await getPromotedWidgets(comfyPage, '11')
      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '11',
        afterSecond
      )

      expect(afterFirst).toEqual(initialWidgets)
      expect(afterSecond).toEqual(initialWidgets)
    })

    test('Compressed target_slot (-1) entries are hydrated to real IDs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-compressed-target-slot'
      )

      const widgets = await getPromotedWidgets(comfyPage, '2')
      expect(widgets.length).toBeGreaterThan(0)

      for (const [interiorNodeId] of widgets) {
        expect(interiorNodeId).not.toBe('-1')
        expect(Number(interiorNodeId)).toBeGreaterThan(0)
      }

      await expectPromotedWidgetsToResolveToInteriorNodes(
        comfyPage,
        '2',
        widgets
      )
    })
  })

  test.describe('Legacy And Round-Trip Coverage', () => {
    let previousUseNewMenu: unknown

    test.beforeEach(async ({ comfyPage }) => {
      previousUseNewMenu =
        await comfyPage.settings.getSetting('Comfy.UseNewMenu')
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.UseNewMenu',
        previousUseNewMenu
      )
    })

    test('Legacy -1 proxyWidgets entries are hydrated to concrete interior node IDs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-compressed-target-slot'
      )

      const promotedWidgets = await getPromotedWidgets(comfyPage, '2')
      expect(promotedWidgets.length).toBeGreaterThan(0)
      expect(
        promotedWidgets.some(([interiorNodeId]) => interiorNodeId === '-1')
      ).toBe(false)
      expect(
        promotedWidgets.some(
          ([interiorNodeId, widgetName]) =>
            interiorNodeId !== '-1' && widgetName === 'batch_size'
        )
      ).toBe(true)
    })

    test('Promoted widgets survive serialize -> loadGraphData round-trip', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const beforePromoted = await getPromotedWidgetNames(comfyPage, '11')
      expect(beforePromoted).toContain('text')

      await comfyPage.subgraph.serializeAndReload()

      const afterPromoted = await getPromotedWidgetNames(comfyPage, '11')
      expect(afterPromoted).toContain('text')

      const widgetCount = await getPromotedWidgetCount(comfyPage, '11')
      expect(widgetCount).toBeGreaterThan(0)
    })

    test('Multi-link input representative stays stable through save/reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-widgets'
      )

      const beforeSnapshot = await getPromotedWidgets(comfyPage, '11')
      expect(beforeSnapshot.length).toBeGreaterThan(0)

      await comfyPage.subgraph.serializeAndReload()

      const afterSnapshot = await getPromotedWidgets(comfyPage, '11')
      expect(afterSnapshot).toEqual(beforeSnapshot)
    })

    test('Cloning a subgraph node keeps promoted widget entries on original and clone', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const originalNode = await comfyPage.nodeOps.getNodeRefById('11')
      const originalPos = await originalNode.getPosition()

      await comfyPage.page.mouse.move(originalPos.x + 16, originalPos.y + 16)
      await comfyPage.page.keyboard.down('Alt')
      try {
        await comfyPage.page.mouse.down()
        await comfyPage.page.mouse.move(originalPos.x + 72, originalPos.y + 72)
        await comfyPage.page.mouse.up()
      } finally {
        await comfyPage.page.keyboard.up('Alt')
      }

      async function collectSubgraphNodeIds() {
        return comfyPage.page.evaluate(() => {
          const graph = window.app!.canvas.graph!
          return graph.nodes
            .filter(
              (n) =>
                typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
            )
            .map((n) => String(n.id))
        })
      }

      await expect
        .poll(async () => (await collectSubgraphNodeIds()).length)
        .toBeGreaterThan(1)

      const subgraphNodeIds = await collectSubgraphNodeIds()
      for (const nodeId of subgraphNodeIds) {
        const promotedWidgets = await getPromotedWidgets(comfyPage, nodeId)
        expect(promotedWidgets.length).toBeGreaterThan(0)
        expect(
          promotedWidgets.some(([, widgetName]) => widgetName === 'text')
        ).toBe(true)
      }
    })
  })

  test.describe('Duplicate ID Remapping', () => {
    test('All node IDs are globally unique after loading', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const result = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const allGraphs = [graph, ...graph.subgraphs.values()]
        const allIds = allGraphs
          .flatMap((g) => g._nodes)
          .map((n) => n.id)
          .filter((id): id is number => typeof id === 'number')

        return { allIds, uniqueCount: new Set(allIds).size }
      })

      expect(result.uniqueCount).toBe(result.allIds.length)
      expect(result.allIds.length).toBeGreaterThanOrEqual(10)
    })

    test('Root graph node IDs are preserved as canonical', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const rootIds = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        return graph._nodes
          .map((n) => n.id)
          .filter((id): id is number => typeof id === 'number')
          .sort((a, b) => a - b)
      })

      expect(rootIds).toEqual([1, 2, 5])
    })

    test('Promoted widget tuples are stable after full page reload boot path', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const beforeSnapshot =
        await comfyPage.subgraph.getHostPromotedTupleSnapshot()
      expect(beforeSnapshot.length).toBeGreaterThan(0)
      expect(
        beforeSnapshot.some(({ promotedWidgets }) => promotedWidgets.length > 0)
      ).toBe(true)

      await comfyPage.page.reload()
      await comfyPage.page.waitForFunction(() => !!window.app)
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      await expect
        .poll(() => comfyPage.subgraph.getHostPromotedTupleSnapshot(), {
          timeout: 5_000
        })
        .toEqual(beforeSnapshot)
    })

    test('All links reference valid nodes in their graph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const invalidLinks = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const labeledGraphs: [string, typeof graph][] = [
          ['root', graph],
          ...[...graph.subgraphs.entries()].map(
            ([id, sg]) => [`subgraph:${id}`, sg] as [string, typeof graph]
          )
        ]

        const SENTINEL_IDS = new Set([-1, -10, -20])
        const isSentinelNodeId = (id: number | string): id is number =>
          typeof id === 'number' && SENTINEL_IDS.has(id)

        const checkEndpoint = (
          label: string,
          kind: 'origin_id' | 'target_id',
          id: number | string,
          g: typeof graph
        ): string | null => {
          if (isSentinelNodeId(id)) return null
          if (typeof id !== 'number' || !g._nodes_by_id[id]) {
            return `${label}: ${kind} ${id} invalid or not found`
          }
          return null
        }

        return labeledGraphs.flatMap(([label, g]) =>
          [...g._links.values()].flatMap((link) =>
            [
              checkEndpoint(label, 'origin_id', link.origin_id, g),
              checkEndpoint(label, 'target_id', link.target_id, g)
            ].filter((e): e is string => e !== null)
          )
        )
      })

      expect(invalidLinks).toEqual([])
    })

    test('Subgraph navigation works after ID remapping', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
      await subgraphNode.navigateIntoSubgraph()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.keyboard.press('Escape')

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
    })
  })

  /**
   * Regression test for legacy-prefixed proxyWidget normalization.
   *
   * Older serialized workflows stored proxyWidget entries with prefixed widget
   * names like "6: 3: string_a" instead of plain "string_a". This caused
   * resolution failures during configure, resulting in missing promoted widgets.
   *
   * The fixture contains an outer SubgraphNode (id 5) whose proxyWidgets array
   * has a legacy-prefixed entry: ["6", "6: 3: string_a"]. After normalization
   * the promoted widget should render with the clean name "string_a".
   *
   * See: https://github.com/Comfy-Org/ComfyUI_frontend/pull/10573
   */
  test.describe(
    'Legacy Prefixed proxyWidget Normalization',
    { tag: ['@subgraph', '@widget'] },
    () => {
      let previousVueNodesEnabled: unknown

      test.beforeEach(async ({ comfyPage }) => {
        previousVueNodesEnabled = await comfyPage.settings.getSetting(
          'Comfy.VueNodes.Enabled'
        )
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          previousVueNodesEnabled
        )
      })

      test('Loads without console warnings about failed widget resolution', async ({
        comfyPage
      }) => {
        const { warnings, dispose } = SubgraphHelper.collectConsoleWarnings(
          comfyPage.page
        )

        try {
          await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)

          comfyExpect(warnings).toEqual([])
        } finally {
          dispose()
        }
      })

      test('Legacy-prefixed promoted widget renders with the normalized label after load', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(outerNode).toBeVisible()

        const textarea = outerNode
          .getByRole('textbox', { name: 'string_a' })
          .first()
        await expect(textarea).toBeVisible()
        await expect(textarea).toBeDisabled()
      })

      test('No legacy-prefixed or disconnected widgets remain on the node', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(outerNode).toBeVisible()

        const widgetRows = outerNode.getByTestId(TestIds.widgets.widget)
        await expect(widgetRows).toHaveCount(2)

        for (const row of await widgetRows.all()) {
          await expect(
            row.getByLabel('string_a', { exact: true })
          ).toBeVisible()
        }
      })
    }
  )

  test(
    'Legacy 3-tuple proxyWidgets entries serialize back to 2-tuples after load',
    { tag: '@vue-nodes' },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(LEGACY_THREE_TUPLE_WORKFLOW)

      const hostNode = comfyPage.vueNodes.getNodeLocator('4')
      await expect(hostNode).toBeVisible()

      const promotedTextbox = hostNode.getByRole('textbox', {
        name: 'text',
        exact: true
      })
      await expect(promotedTextbox).toHaveCount(1)
      await expect(promotedTextbox).toHaveValue('22222222222')

      await expect(hostNode.getByText('text', { exact: true })).toBeVisible()

      const serializedProxyWidgets = await comfyPage.page.evaluate(() => {
        const serialized = window.app!.graph!.serialize()
        const hostNode = serialized.nodes.find((node) => node.id === 4)
        const proxyWidgets = hostNode?.properties?.proxyWidgets
        return Array.isArray(proxyWidgets) ? proxyWidgets : []
      })

      expect(serializedProxyWidgets).toEqual([['3', '3: 2: text']])
      expect(
        serializedProxyWidgets.every(
          (entry) => Array.isArray(entry) && entry.length === 2
        )
      ).toBe(true)
    }
  )

  test('Multiple instances of the same subgraph keep distinct promoted widget values after load and reload', async ({
    comfyPage
  }) => {
    const hostNodeIds = ['11', '12', '13']
    const expectedValues = ['Alpha\n', 'Beta\n', 'Gamma\n']

    await comfyPage.workflow.loadWorkflow(MULTI_INSTANCE_WORKFLOW)

    const initialValues = await getPromotedHostWidgetValues(
      comfyPage,
      hostNodeIds
    )
    expect(initialValues.map(({ values }) => values[0])).toEqual(expectedValues)

    await comfyPage.subgraph.serializeAndReload()

    const reloadedValues = await getPromotedHostWidgetValues(
      comfyPage,
      hostNodeIds
    )
    expect(reloadedValues.map(({ values }) => values[0])).toEqual(
      expectedValues
    )
  })
})
