import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyPage } from '../fixtures/ComfyPage'
import type { PromotedWidgetEntry } from '../helpers/promotedWidgets'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'
import {
  getPromotedWidgets,
  getPseudoPreviewWidgets,
  getNonPreviewPromotedWidgets
} from '../helpers/promotedWidgets'

const domPreviewSelector = '.image-preview'

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

test.describe(
  'Subgraph Lifecycle Edge Behaviors',
  { tag: ['@subgraph'] },
  () => {
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

        const serialized1 = await comfyPage.page.evaluate(() =>
          window.app!.graph!.serialize()
        )
        await comfyPage.page.evaluate(
          (workflow: ComfyWorkflowJSON) => window.app!.loadGraphData(workflow),
          serialized1 as ComfyWorkflowJSON
        )
        await comfyPage.nextFrame()

        const afterFirst = await getPromotedWidgets(comfyPage, '11')
        await expectPromotedWidgetsToResolveToInteriorNodes(
          comfyPage,
          '11',
          afterFirst
        )

        const serialized2 = await comfyPage.page.evaluate(() =>
          window.app!.graph!.serialize()
        )
        await comfyPage.page.evaluate(
          (workflow: ComfyWorkflowJSON) => window.app!.loadGraphData(workflow),
          serialized2 as ComfyWorkflowJSON
        )
        await comfyPage.nextFrame()

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

    test.describe('Cleanup Behavior After Promoted Source Removal', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      })

      test('Removing promoted source node inside subgraph cleans up exterior proxyWidgets', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        const initialWidgets = await getPromotedWidgets(comfyPage, '11')
        expect(initialWidgets.length).toBeGreaterThan(0)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        const clipNode = await comfyPage.nodeOps.getNodeRefById('10')
        await clipNode.click('title')
        await comfyPage.page.keyboard.press('Delete')
        await comfyPage.nextFrame()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect
          .poll(async () => {
            return await comfyPage.page.evaluate(() => {
              const hostNode = window.app!.canvas.graph!.getNodeById('11')
              const proxyWidgets = hostNode?.properties?.proxyWidgets
              return {
                proxyWidgetCount: Array.isArray(proxyWidgets)
                  ? proxyWidgets.length
                  : 0,
                firstWidgetType: hostNode?.widgets?.[0]?.type
              }
            })
          })
          .toEqual({
            proxyWidgetCount: 0,
            firstWidgetType: undefined
          })
      })

      test('Promoted widget disappears from DOM after interior node deletion', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )
        await comfyPage.nextFrame()

        const textarea = comfyPage.page.getByTestId(
          TestIds.widgets.domWidgetTextarea
        )
        await expect(textarea).toBeVisible()

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
        await subgraphNode.navigateIntoSubgraph()

        const clipNode = await comfyPage.nodeOps.getNodeRefById('10')
        await clipNode.click('title')
        await comfyPage.page.keyboard.press('Delete')
        await comfyPage.nextFrame()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect(
          comfyPage.page.getByTestId(TestIds.widgets.domWidgetTextarea)
        ).toHaveCount(0)
      })
    })

    test.describe('Unpack/Remove Cleanup for Pseudo-Preview Targets', () => {
      test('Pseudo-preview entries exist in proxyWidgets for preview subgraph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.nextFrame()

        const pseudoWidgets = await getPseudoPreviewWidgets(comfyPage, '5')
        expect(pseudoWidgets.length).toBeGreaterThan(0)
        expect(
          pseudoWidgets.some(([, name]) => name === '$$canvas-image-preview')
        ).toBe(true)
      })

      test('Non-preview widgets coexist with pseudo-preview entries', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.nextFrame()

        const pseudoWidgets = await getPseudoPreviewWidgets(comfyPage, '5')
        const nonPreviewWidgets = await getNonPreviewPromotedWidgets(
          comfyPage,
          '5'
        )

        expect(pseudoWidgets.length).toBeGreaterThan(0)
        expect(nonPreviewWidgets.length).toBeGreaterThan(0)
        expect(
          nonPreviewWidgets.some(([, name]) => name === 'filename_prefix')
        ).toBe(true)
      })

      test('Unpacking subgraph clears pseudo-preview entries from graph', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.nextFrame()

        const beforePseudo = await getPseudoPreviewWidgets(comfyPage, '5')
        expect(beforePseudo.length).toBeGreaterThan(0)

        await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph!
          const subgraphNode = graph.nodes.find((n) => n.isSubgraphNode())
          if (!subgraphNode || !subgraphNode.isSubgraphNode()) return
          graph.unpackSubgraph(subgraphNode)
        })
        await comfyPage.nextFrame()

        const subgraphNodeCount = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph!
          return graph.nodes.filter((n) => n.isSubgraphNode()).length
        })
        expect(subgraphNodeCount).toBe(0)

        await expect
          .poll(async () => comfyPage.subgraph.countGraphPseudoPreviewEntries())
          .toBe(0)
      })

      test('Removing subgraph node clears pseudo-preview DOM elements', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.nextFrame()

        const beforePseudo = await getPseudoPreviewWidgets(comfyPage, '5')
        expect(beforePseudo.length).toBeGreaterThan(0)

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
        expect(await subgraphNode.exists()).toBe(true)

        await subgraphNode.click('title')
        await comfyPage.page.keyboard.press('Delete')
        await comfyPage.nextFrame()

        const nodeExists = await comfyPage.page.evaluate(() => {
          return !!window.app!.canvas.graph!.getNodeById('5')
        })
        expect(nodeExists).toBe(false)

        await expect
          .poll(async () => comfyPage.subgraph.countGraphPseudoPreviewEntries())
          .toBe(0)
        await expect(comfyPage.page.locator(domPreviewSelector)).toHaveCount(0)
      })

      test('Unpacking one subgraph does not clear sibling pseudo-preview entries', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-multiple-promoted-previews'
        )
        await comfyPage.nextFrame()

        const firstNodeBefore = await getPseudoPreviewWidgets(comfyPage, '7')
        const secondNodeBefore = await getPseudoPreviewWidgets(comfyPage, '8')

        expect(firstNodeBefore.length).toBeGreaterThan(0)
        expect(secondNodeBefore.length).toBeGreaterThan(0)

        await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph!
          const subgraphNode = graph.getNodeById('7')
          if (!subgraphNode || !subgraphNode.isSubgraphNode()) return
          graph.unpackSubgraph(subgraphNode)
        })
        await comfyPage.nextFrame()

        const firstNodeExists = await comfyPage.page.evaluate(() => {
          return !!window.app!.graph!.getNodeById('7')
        })
        expect(firstNodeExists).toBe(false)

        const secondNodeAfter = await getPseudoPreviewWidgets(comfyPage, '8')
        expect(secondNodeAfter).toEqual(secondNodeBefore)
      })
    })
  }
)
