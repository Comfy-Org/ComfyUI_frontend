import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

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

        const widgetNames = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.canvas.graph!.getNodeById(nodeId)
          return (node?.widgets ?? []).map((w) => w.name)
        }, SUBGRAPH_NODE_ID)

        expect(widgetNames).toContain('my_seed')
        expect(widgetNames).toContain('num_steps')
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
        const widgetNames = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.canvas.graph!.getNodeById(nodeId)
          return (node?.widgets ?? []).map((w) => w.name)
        }, SUBGRAPH_NODE_ID)

        expect(widgetNames).toContain('renamed_seed')
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

        const seedWidget = widgetNames.find((w) => w.name === 'my_seed')
        const stepsWidget = widgetNames.find((w) => w.name === 'num_steps')

        expect(seedWidget).toBeDefined()
        expect(stepsWidget).toBeDefined()
        expect(seedWidget?.label).toBe('my_seed')
        expect(stepsWidget?.label).toBe('num_steps')
      })
    })
  }
)
