import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'

/** Read interior node widget names from the subgraph without navigating into it. */
async function getInteriorWidgetNames(
  comfyPage: ComfyPage,
  subgraphNodeId: string,
  interiorType: string
): Promise<string[]> {
  return comfyPage.page.evaluate(
    ([nodeId, type]) => {
      const sgNode = window.app!.canvas.graph!.getNodeById(
        nodeId
      ) as unknown as SubgraphNode
      const subgraph = sgNode?.subgraph
      if (!subgraph) throw new Error('No subgraph found')
      const interior = (subgraph._nodes as LGraphNode[]).find(
        (n) => n.type === type
      )
      return ((interior?.widgets ?? []) as IBaseWidget[]).map((w) => w.name)
    },
    [subgraphNodeId, interiorType] as const
  )
}

test.describe(
  'Subgraph Promoted Widget Renamed Labels',
  { tag: ['@subgraph', '@widget'] },
  () => {
    const WORKFLOW = 'subgraphs/subgraph-with-renamed-promoted-labels'
    const SUBGRAPH_NODE_ID = '2'

    test.describe('Vue Node rendering', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      })

      test('Promoted widgets display user-renamed labels instead of interior widget names', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.vueNodes.waitForNodes()

        const subgraphNode = comfyPage.vueNodes.getNodeLocator(SUBGRAPH_NODE_ID)
        await expect(subgraphNode).toBeVisible()

        const nodeBody = subgraphNode.locator(
          `[data-testid="node-body-${SUBGRAPH_NODE_ID}"]`
        )
        await expect(nodeBody).toBeVisible()

        // The promoted widgets should display the renamed labels
        await expect(nodeBody).toContainText('my_seed')
        await expect(nodeBody).toContainText('num_steps')
      })
    })

    test.describe('Round-trip persistence', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      })

      test('Renamed labels survive serialize -> loadGraphData round-trip', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.nextFrame()

        const serialized = await comfyPage.page.evaluate(() => {
          return window.app!.graph!.serialize()
        })

        await comfyPage.page.evaluate((workflow: ComfyWorkflowJSON) => {
          return window.app!.loadGraphData(workflow)
        }, serialized as ComfyWorkflowJSON)
        await comfyPage.nextFrame()

        const widgetLabels = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.canvas.graph!.getNodeById(nodeId)
          return (node?.widgets ?? []).map((w) => w.label)
        }, SUBGRAPH_NODE_ID)

        expect(widgetLabels).toContain('my_seed')
        expect(widgetLabels).toContain('num_steps')
      })
    })

    test.describe('Rename inside subgraph', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      })

      test('Renaming a promoted input slot inside the subgraph updates the label on the SubgraphNode', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.nextFrame()

        const subgraphNode =
          await comfyPage.nodeOps.getNodeRefById(SUBGRAPH_NODE_ID)
        await subgraphNode.navigateIntoSubgraph()

        // Rename the "seed" input slot (currently labeled "my_seed") to "renamed_seed"
        await comfyPage.subgraph.rightClickInputSlot('seed')
        await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
        await comfyPage.nextFrame()

        await comfyPage.page.waitForSelector('.graphdialog input', {
          state: 'visible'
        })
        await comfyPage.page.fill('.graphdialog input', 'renamed_seed')
        await comfyPage.page.keyboard.press('Enter')
        await comfyPage.nextFrame()

        // Navigate back to root graph
        await comfyPage.subgraph.exitViaBreadcrumb()

        // Verify the promoted widget now shows the new label
        const widgetLabels = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.canvas.graph!.getNodeById(nodeId)
          return (node?.widgets ?? []).map((w) => w.label)
        }, SUBGRAPH_NODE_ID)

        expect(widgetLabels).toContain('renamed_seed')
      })
    })

    test.describe('Rename non-propagation', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      })

      test('Renaming a promoted widget does not change interior node widget names', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.nextFrame()

        // Read interior widget names via the subgraph object (no navigation needed)
        const interiorWidgetsBefore = await getInteriorWidgetNames(
          comfyPage,
          SUBGRAPH_NODE_ID,
          'KSampler'
        )

        // Rename "seed" slot from root graph
        const subgraphNode =
          await comfyPage.nodeOps.getNodeRefById(SUBGRAPH_NODE_ID)
        await subgraphNode.navigateIntoSubgraph()

        await comfyPage.subgraph.rightClickInputSlot('seed')
        await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
        await comfyPage.nextFrame()
        await comfyPage.page.waitForSelector('.graphdialog input', {
          state: 'visible'
        })
        await comfyPage.page.fill('.graphdialog input', 'totally_new_name')
        await comfyPage.page.keyboard.press('Enter')
        await comfyPage.nextFrame()

        // Navigate back to root
        await comfyPage.subgraph.exitViaBreadcrumb()

        // Verify interior widget names are unchanged
        const interiorWidgetsAfter = await getInteriorWidgetNames(
          comfyPage,
          SUBGRAPH_NODE_ID,
          'KSampler'
        )

        expect(interiorWidgetsAfter).toEqual(interiorWidgetsBefore)
      })
    })

    test.describe('Legacy Node rendering', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      })

      test('Promoted widgets display user-renamed labels on legacy canvas', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(WORKFLOW)
        await comfyPage.nextFrame()

        // Verify the widget labels via the PromotedWidgetView name property
        const widgetNames = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.canvas.graph!.getNodeById(nodeId)
          return (node?.widgets ?? []).map((w) => ({
            name: w.name,
            label: w.label
          }))
        }, SUBGRAPH_NODE_ID)

        // name is now the stable identity (e.g. "seed"), label is the user rename
        const seedWidget = widgetNames.find((w) => w.name === 'seed')
        const stepsWidget = widgetNames.find((w) => w.name === 'steps')

        expect(seedWidget).toBeDefined()
        expect(stepsWidget).toBeDefined()
        expect(seedWidget?.label).toBe('my_seed')
        expect(stepsWidget?.label).toBe('num_steps')
      })
    })
  }
)
