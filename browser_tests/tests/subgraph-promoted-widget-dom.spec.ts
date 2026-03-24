import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { getPromotedWidgetNames } from '../helpers/promotedWidgets'

test.describe(
  'Subgraph promoted widget DOM position',
  { tag: '@subgraph' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    })

    test('Promoted seed widget renders in node body, not header', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')

      // Convert KSampler (id 3) to subgraph — seed is auto-promoted.
      const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
      await ksampler.click('title')
      const subgraphNode = await ksampler.convertToSubgraph()
      await comfyPage.nextFrame()

      // Enable Vue nodes now that the subgraph has been created
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

      const subgraphNodeId = String(subgraphNode.id)
      const promotedNames = await getPromotedWidgetNames(
        comfyPage,
        subgraphNodeId
      )
      expect(promotedNames).toContain('seed')

      // Wait for Vue nodes to render
      await comfyPage.vueNodes.waitForNodes()

      const nodeLocator = comfyPage.vueNodes.getNodeLocator(subgraphNodeId)
      await expect(nodeLocator).toBeVisible()

      // The seed widget should be visible inside the node body
      const seedWidget = nodeLocator.getByLabel('seed', { exact: true }).first()
      await expect(seedWidget).toBeVisible()

      // Verify widget is inside the node body, not the header
      const headerBox = await nodeLocator
        .locator('[data-testid^="node-header-"]')
        .boundingBox()
      const widgetBox = await seedWidget.boundingBox()
      expect(headerBox).not.toBeNull()
      expect(widgetBox).not.toBeNull()

      // Widget top should be below the header bottom
      expect(widgetBox!.y).toBeGreaterThan(headerBox!.y + headerBox!.height)
    })
  }
)
