import { expect } from '@playwright/test'

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

        // They should NOT display the original interior widget names
        // (seed/steps would appear as standalone text only if labels are broken)
        const bodyText = await nodeBody.textContent()
        const seedOnlyMatches = bodyText
          ?.split('my_seed')
          .join('')
          .match(/\bseed\b/g)
        const stepsOnlyMatches = bodyText
          ?.split('num_steps')
          .join('')
          .match(/\bsteps\b/g)
        expect(seedOnlyMatches ?? []).toHaveLength(0)
        expect(stepsOnlyMatches ?? []).toHaveLength(0)
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
