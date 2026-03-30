import { expect } from '@playwright/test'

import type { ComfyPage } from '../../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { SubgraphHelper } from '../../fixtures/helpers/SubgraphHelper'
import { TestIds } from '../../fixtures/selectors'
import type { PromotedWidgetEntry } from '../../helpers/promotedWidgets'
import { getPromotedWidgets } from '../../helpers/promotedWidgets'

const DUPLICATE_IDS_WORKFLOW = 'subgraphs/subgraph-nested-duplicate-ids'
const LEGACY_PREFIXED_WORKFLOW =
  'subgraphs/nested-subgraph-legacy-prefixed-proxy-widgets'

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
  test.describe('Deterministic Hydrate from Serialized proxyWidgets', () => {
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

    test('Can create widget from link with compressed target_slot', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-compressed-target-slot'
      )

      const step = await comfyPage.page.evaluate(() => {
        return window.app!.graph!.nodes[0].widgets![0].options.step
      })

      expect(step).toBe(10)
    })
  })

  test.describe('Subgraph duplicate ID remapping', () => {
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
          .map((node) => node.id)
          .filter((id): id is number => typeof id === 'number')
          .sort((a, b) => a - b)
      })

      expect(rootIds).toEqual([1, 2, 5])
    })

    test('Promoted widget tuples are stable after full page reload boot path', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)
      await comfyPage.nextFrame()

      const beforeSnapshot =
        await comfyPage.subgraph.getHostPromotedTupleSnapshot()
      expect(beforeSnapshot.length).toBeGreaterThan(0)
      expect(
        beforeSnapshot.some(({ promotedWidgets }) => promotedWidgets.length > 0)
      ).toBe(true)

      await comfyPage.page.reload()
      await comfyPage.page.waitForFunction(() => !!window.app)
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)
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
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

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
      await comfyPage.workflow.loadWorkflow(DUPLICATE_IDS_WORKFLOW)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
      await subgraphNode.navigateIntoSubgraph()

      expect(await comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      expect(await comfyPage.subgraph.isInSubgraph()).toBe(false)
    })
  })

  test.describe('Legacy prefixed proxyWidget normalization', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    })

    test('Loads without console warnings about failed widget resolution', async ({
      comfyPage
    }) => {
      const { warnings } = SubgraphHelper.collectConsoleWarnings(comfyPage.page)

      await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)

      expect(warnings).toEqual([])
    })

    test('Promoted widget renders with normalized name, not legacy prefix', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('5')
      await expect(outerNode).toBeVisible()

      const promotedWidget = outerNode
        .getByLabel('string_a', { exact: true })
        .first()
      await expect(promotedWidget).toBeVisible()
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
        await expect(row.getByLabel('string_a', { exact: true })).toBeVisible()
      }
    })

    test('Promoted widget value is editable as a text input', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(LEGACY_PREFIXED_WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()

      const outerNode = comfyPage.vueNodes.getNodeLocator('5')
      const textarea = outerNode
        .getByRole('textbox', { name: 'string_a' })
        .first()
      await expect(textarea).toBeVisible()
    })
  })
})
