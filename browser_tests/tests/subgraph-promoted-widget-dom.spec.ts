import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { SubgraphHelper } from '../fixtures/helpers/SubgraphHelper'
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
      const subgraphNode =
        await comfyPage.subgraph.convertDefaultKSamplerToSubgraph()

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
      await SubgraphHelper.expectWidgetBelowHeader(nodeLocator, seedWidget)
    })
  }
)
