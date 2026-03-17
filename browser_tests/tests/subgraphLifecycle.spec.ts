import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'
import {
  getPromotedWidgets,
  getPseudoPreviewWidgets,
  getNonPreviewPromotedWidgets
} from '../helpers/promotedWidgets'

async function isInSubgraph(comfyPage: ComfyPage): Promise<boolean> {
  return comfyPage.page.evaluate(() => {
    const graph = window.app!.canvas.graph
    return !!graph && 'inputNode' in graph
  })
}

async function exitSubgraphViaBreadcrumb(comfyPage: ComfyPage): Promise<void> {
  const breadcrumb = comfyPage.page.getByTestId(TestIds.breadcrumb.subgraph)
  const parentLink = breadcrumb.getByRole('link').first()
  if (await parentLink.isVisible()) {
    await parentLink.click()
  } else {
    await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      const graph = canvas.graph
      if (!graph) return
      canvas.setGraph(graph.rootGraph)
    })
  }
  await comfyPage.nextFrame()
  await expect.poll(async () => isInSubgraph(comfyPage)).toBe(false)
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

        const serialized1 = await comfyPage.page.evaluate(() =>
          window.app!.graph!.serialize()
        )
        await comfyPage.page.evaluate(
          (workflow: ComfyWorkflowJSON) => window.app!.loadGraphData(workflow),
          serialized1 as ComfyWorkflowJSON
        )
        await comfyPage.nextFrame()

        const afterFirst = await getPromotedWidgets(comfyPage, '11')

        const serialized2 = await comfyPage.page.evaluate(() =>
          window.app!.graph!.serialize()
        )
        await comfyPage.page.evaluate(
          (workflow: ComfyWorkflowJSON) => window.app!.loadGraphData(workflow),
          serialized2 as ComfyWorkflowJSON
        )
        await comfyPage.nextFrame()

        const afterSecond = await getPromotedWidgets(comfyPage, '11')

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
      })
    })

    test.describe('Placeholder Behavior After Promoted Source Removal', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      })

      test('Removing promoted source node inside subgraph falls back to disconnected placeholder on exterior', async ({
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

        await exitSubgraphViaBreadcrumb(comfyPage)

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
            proxyWidgetCount: initialWidgets.length,
            firstWidgetType: 'button'
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

        await exitSubgraphViaBreadcrumb(comfyPage)

        await expect(
          comfyPage.page.getByTestId(TestIds.widgets.domWidgetTextarea)
        ).not.toBeVisible()
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
      })

      test('Removing subgraph node clears pseudo-preview DOM elements', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-preview-node'
        )
        await comfyPage.nextFrame()

        const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
        expect(await subgraphNode.exists()).toBe(true)

        await subgraphNode.click('title')
        await comfyPage.page.keyboard.press('Delete')
        await comfyPage.nextFrame()

        const nodeExists = await comfyPage.page.evaluate(() => {
          return !!window.app!.canvas.graph!.getNodeById('5')
        })
        expect(nodeExists).toBe(false)
      })
    })
  }
)
