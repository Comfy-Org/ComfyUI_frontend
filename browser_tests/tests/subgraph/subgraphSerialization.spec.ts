import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { PromotedWidgetEntry } from '@e2e/helpers/promotedWidgets'

import { comfyPageFixture as test, comfyExpect } from '@e2e/fixtures/ComfyPage'
import { SubgraphHelper } from '@e2e/fixtures/helpers/SubgraphHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  getPromotedWidgets,
  getPromotedWidgetNames,
  getPromotedWidgetCount
} from '@e2e/helpers/promotedWidgets'

const expectPromotedWidgetsToResolveToInteriorNodes = async (
  comfyPage: ComfyPage,
  hostSubgraphNodeId: string,
  widgets: PromotedWidgetEntry[]
) => {
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

  for (const exists of results) {
    expect(exists).toBe(true)
  }
}

test.describe('Subgraph Serialization', { tag: ['@subgraph'] }, () => {
  test.describe('Deterministic proxyWidgets Hydrate', () => {
    test('proxyWidgets entries map to real interior node IDs after load', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()

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
      await comfyPage.nextFrame()

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
      await comfyPage.nextFrame()

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
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Legacy -1 proxyWidgets entries are hydrated to concrete interior node IDs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-compressed-target-slot'
      )
      await comfyPage.nextFrame()

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
      await comfyPage.nextFrame()

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
      await comfyPage.nextFrame()

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
      await comfyPage.nextFrame()

      const originalNode = await comfyPage.nodeOps.getNodeRefById('11')
      const originalPos = await originalNode.getPosition()

      await comfyPage.page.mouse.move(originalPos.x + 16, originalPos.y + 16)
      await comfyPage.page.keyboard.down('Alt')
      await comfyPage.page.mouse.down()
      await comfyPage.nextFrame()
      await comfyPage.page.mouse.move(originalPos.x + 72, originalPos.y + 72)
      await comfyPage.page.mouse.up()
      await comfyPage.page.keyboard.up('Alt')
      await comfyPage.nextFrame()

      const subgraphNodeIds = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        return graph.nodes
          .filter(
            (n) => typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
          )
          .map((n) => String(n.id))
      })

      expect(subgraphNodeIds.length).toBeGreaterThan(1)
      for (const nodeId of subgraphNodeIds) {
        const promotedWidgets = await getPromotedWidgets(comfyPage, nodeId)
        expect(promotedWidgets.length).toBeGreaterThan(0)
        expect(
          promotedWidgets.some(([, widgetName]) => widgetName === 'text')
        ).toBe(true)
      }
    })
  })

  test.describe('Duplicate ID Remapping', { tag: ['@subgraph'] }, () => {
    const WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'

    test('All node IDs are globally unique after loading', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      const result = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        // TODO: Extract allGraphs accessor (root + subgraphs) into LGraph
        // TODO: Extract allNodeIds accessor into LGraph
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
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

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
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      const beforeSnapshot =
        await comfyPage.subgraph.getHostPromotedTupleSnapshot()
      expect(beforeSnapshot.length).toBeGreaterThan(0)
      expect(
        beforeSnapshot.some(({ promotedWidgets }) => promotedWidgets.length > 0)
      ).toBe(true)

      await comfyPage.page.reload()
      await comfyPage.page.waitForFunction(() => !!window.app)
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()

      await expect(async () => {
        const afterSnapshot =
          await comfyPage.subgraph.getHostPromotedTupleSnapshot()
        expect(afterSnapshot).toEqual(beforeSnapshot)
      }).toPass({ timeout: 5_000 })
    })

    test('All links reference valid nodes in their graph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      const invalidLinks = await comfyPage.page.evaluate(() => {
        const graph = window.app!.canvas.graph!
        const labeledGraphs: [string, typeof graph][] = [
          ['root', graph],
          ...[...graph.subgraphs.entries()].map(
            ([id, sg]) => [`subgraph:${id}`, sg] as [string, typeof graph]
          )
        ]

        const isNonNegative = (id: number | string) =>
          typeof id === 'number' && id >= 0

        return labeledGraphs.flatMap(([label, g]) =>
          [...g._links.values()].flatMap((link) =>
            [
              isNonNegative(link.origin_id) &&
                !g._nodes_by_id[link.origin_id] &&
                `${label}: origin_id ${link.origin_id} not found`,
              isNonNegative(link.target_id) &&
                !g._nodes_by_id[link.target_id] &&
                `${label}: target_id ${link.target_id} not found`
            ].filter(Boolean)
          )
        )
      })

      expect(invalidLinks).toEqual([])
    })

    test('Subgraph navigation works after ID remapping', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
      await subgraphNode.navigateIntoSubgraph()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

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
      const WORKFLOW = 'subgraphs/nested-subgraph-legacy-prefixed-proxy-widgets'

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Loads without console warnings about failed widget resolution', async ({
        comfyPage
      }) => {
        const { warnings } = SubgraphHelper.collectConsoleWarnings(
          comfyPage.page
        )

        await comfyPage.workflow.loadWorkflow(WORKFLOW)

        comfyExpect(warnings).toEqual([])
      })

      test('Promoted widget renders with normalized name, not legacy prefix', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(outerNode).toBeVisible()

        // The promoted widget should render with the clean name "string_a",
        // not the legacy-prefixed "6: 3: string_a".
        const promotedWidget = outerNode
          .getByLabel('string_a', { exact: true })
          .first()
        await expect(promotedWidget).toBeVisible()
      })

      test('No legacy-prefixed or disconnected widgets remain on the node', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        await expect(outerNode).toBeVisible()

        // Both widget rows should be valid "string_a" widgets — no stale
        // "Disconnected" placeholders from unresolved legacy entries.
        const widgetRows = outerNode.getByTestId(TestIds.widgets.widget)
        await expect(widgetRows).toHaveCount(2)

        for (const row of await widgetRows.all()) {
          await expect(
            row.getByLabel('string_a', { exact: true })
          ).toBeVisible()
        }
      })

      test('Promoted widget value is editable as a text input', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const outerNode = comfyPage.vueNodes.getNodeLocator('5')
        const textarea = outerNode
          .getByRole('textbox', { name: 'string_a' })
          .first()
        await expect(textarea).toBeVisible()
      })
    }
  )
})
