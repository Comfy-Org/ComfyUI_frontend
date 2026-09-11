import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('API node pricing badge', { tag: ['@node', '@widget'] }, () => {
  test.beforeEach(async ({ comfyPage, context }) => {
    await context.route(
      'https://comfyanonymous.github.io/ComfyUI_examples/',
      (route) =>
        route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
    )
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.NodeBadge.ShowApiPricing', false)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.NodeBadge.ShowApiPricing', false)
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
  })

  test('follows the pricing setting', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('partner_api_node')
    await comfyPage.vueNodes.waitForNodes(1)
    const apiNode = await comfyPage.vueNodes.getFixtureByTitle(
      'Flux 1.1 [pro] Ultra Image'
    )

    await expect(apiNode.priceBadge.required).toBeHidden()
    await comfyPage.settings.setSetting('Comfy.NodeBadge.ShowApiPricing', true)
    await expect(apiNode.priceBadge.required).toBeVisible()
    await comfyPage.settings.setSetting('Comfy.NodeBadge.ShowApiPricing', false)
    await expect(apiNode.priceBadge.required).toBeHidden()
  })
})
