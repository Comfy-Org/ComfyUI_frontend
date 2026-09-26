import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/legacyNodeBadgeFixture'

const API_NODE_TITLE = 'Flux 1.1 [pro] Ultra Image'
const PRICE_TEXT = '12.7 credits/Run'

test.use({ initialSettings: { 'Comfy.NodeBadge.ShowApiPricing': true } })

test.beforeEach(async ({ context }) => {
  await context.route(
    'https://comfyanonymous.github.io/ComfyUI_examples/',
    (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
  )
})

test.describe(
  'API node pricing badge (Vue)',
  { tag: ['@node', '@widget', '@vue-nodes'] },
  () => {
    test('follows the Settings UI toggle', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('partner_api_node')
      const vueNode = await comfyPage.vueNodes.getFixtureByTitle(API_NODE_TITLE)

      await test.step('show pricing initially', async () => {
        await expect(vueNode.priceBadge.required).toBeVisible()
      })

      await test.step('hide pricing through Settings', async () => {
        await toggleApiPricing(comfyPage)
        await expect(vueNode.priceBadge.required).toBeHidden()
      })

      await test.step('restore pricing through Settings', async () => {
        await toggleApiPricing(comfyPage)
        await expect(vueNode.priceBadge.required).toBeVisible()
      })
    })
  }
)

test.describe(
  'API node pricing badge (legacy)',
  { tag: ['@node', '@widget'] },
  () => {
    test('follows the Settings UI toggle', async ({
      comfyPage,
      legacyNodeBadges
    }) => {
      await comfyPage.workflow.loadWorkflow('partner_api_node')
      await legacyNodeBadges.install([{ key: 'price', title: API_NODE_TITLE }])

      await test.step('show pricing initially', async () => {
        await legacyNodeBadges.expectState([
          { key: 'price', text: PRICE_TEXT, visible: true }
        ])
      })

      await test.step('hide pricing through Settings', async () => {
        await toggleApiPricing(comfyPage)
        await legacyNodeBadges.expectState([
          { key: 'price', text: PRICE_TEXT, visible: false }
        ])
      })

      await test.step('restore pricing through Settings', async () => {
        await toggleApiPricing(comfyPage)
        await legacyNodeBadges.expectState([
          { key: 'price', text: PRICE_TEXT, visible: true }
        ])
      })
    })
  }
)

async function toggleApiPricing(comfyPage: ComfyPage) {
  await comfyPage.settingDialog.open()
  await comfyPage.settingDialog.category('Comfy').click()
  await comfyPage.settingDialog.toggleBooleanSetting(
    'Comfy.NodeBadge.ShowApiPricing'
  )
  await comfyPage.settingDialog.close()
}
