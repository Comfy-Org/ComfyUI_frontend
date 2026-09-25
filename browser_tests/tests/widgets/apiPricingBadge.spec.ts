import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

for (const vueEnabled of [false, true] as const) {
  const renderer = vueEnabled ? 'vue' : 'legacy'

  test.describe(
    `API node pricing badge (${renderer})`,
    { tag: ['@node', '@widget'] },
    () => {
      test.beforeEach(async ({ comfyPage, context }) => {
        await context.route(
          'https://comfyanonymous.github.io/ComfyUI_examples/',
          (route) =>
            route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
        )
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueEnabled
        )
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.ShowApiPricing',
          true
        )
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.NodeBadge.ShowApiPricing',
          true
        )
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      })

      test('follows the Settings UI toggle', async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('partner_api_node')

        const vueNode = vueEnabled
          ? await comfyPage.vueNodes.getFixtureByTitle(
              'Flux 1.1 [pro] Ultra Image'
            )
          : undefined
        if (vueNode) {
          await comfyPage.vueNodes.waitForNodes(1)
        } else {
          await comfyPage.legacyNodeBadges.install([
            { key: 'price', title: 'Flux 1.1 [pro] Ultra Image' }
          ])
        }

        await test.step('show pricing initially', async () => {
          if (vueNode) {
            await expect(vueNode.priceBadge.required).toBeVisible()
          } else {
            await comfyPage.legacyNodeBadges.expectText(
              'price',
              '12.7 credits/Run',
              true
            )
          }
        })

        await test.step('hide pricing through Settings', async () => {
          await comfyPage.settingDialog.open()
          await comfyPage.settingDialog.category('Comfy').click()
          await comfyPage.settingDialog.toggleBooleanSetting(
            'Comfy.NodeBadge.ShowApiPricing'
          )
          await comfyPage.settingDialog.close()

          if (vueNode) {
            await expect(vueNode.priceBadge.required).toBeHidden()
          } else {
            await comfyPage.legacyNodeBadges.expectState([
              { key: 'price', text: '12.7 credits/Run', visible: false }
            ])
          }
        })

        await test.step('restore pricing through Settings', async () => {
          await comfyPage.settingDialog.open()
          await comfyPage.settingDialog.category('Comfy').click()
          await comfyPage.settingDialog.toggleBooleanSetting(
            'Comfy.NodeBadge.ShowApiPricing'
          )
          await comfyPage.settingDialog.close()

          if (vueNode) {
            await expect(vueNode.priceBadge.required).toBeVisible()
          } else {
            await comfyPage.legacyNodeBadges.expectText(
              'price',
              '12.7 credits/Run',
              true
            )
          }
        })
      })
    }
  )
}
