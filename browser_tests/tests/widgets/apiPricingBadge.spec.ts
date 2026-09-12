import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const EXPECTED_PRICE = '12.7 credits/Run'

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
          await expect(vueNode.priceBadge.required).toBeVisible()
        } else {
          await comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              ({ title }) => title === 'Flux 1.1 [pro] Ultra Image'
            )
            if (!node) throw new Error('Partner API node not found')

            const probe = document.createElement('output')
            probe.id = 'legacy-pricing-badge-draw-probe'
            probe.hidden = true
            probe.dataset.suppress = 'false'
            document.body.append(probe)

            const drawBadges = node.drawBadges
            node.drawBadges = function (ctx, options) {
              const fillText = ctx.fillText
              ctx.fillText = function (text, ...args) {
                if (
                  probe.dataset.suppress === 'true' &&
                  text === '12.7 credits/Run'
                ) {
                  return
                }
                fillText.call(this, text, ...args)
                if (text === '12.7 credits/Run') probe.textContent = text
              }
              try {
                drawBadges.call(this, ctx, options)
              } finally {
                ctx.fillText = fillText
              }
            }
            window.app!.graph.setDirtyCanvas(true, true)
          })
        }

        const legacyDrawProbe = comfyPage.page.locator(
          '#legacy-pricing-badge-draw-probe'
        )
        if (!vueEnabled) {
          await expect(legacyDrawProbe).toHaveText(EXPECTED_PRICE)
        }

        await comfyPage.settingDialog.open()
        await comfyPage.settingDialog.category('Comfy').click()
        await comfyPage.settingDialog.toggleBooleanSetting(
          'Comfy.NodeBadge.ShowApiPricing'
        )
        await comfyPage.settingDialog.close()

        if (vueNode) await expect(vueNode.priceBadge.required).toBeHidden()
        if (!vueEnabled) {
          await legacyDrawProbe.evaluate((probe) => {
            probe.textContent = ''
          })
          await comfyPage.nextFrame()
          await expect(legacyDrawProbe).toHaveText('')
        }

        await comfyPage.settingDialog.open()
        await comfyPage.settingDialog.category('Comfy').click()
        await comfyPage.settingDialog.toggleBooleanSetting(
          'Comfy.NodeBadge.ShowApiPricing'
        )
        await comfyPage.settingDialog.close()

        if (vueNode) await expect(vueNode.priceBadge.required).toBeVisible()
        if (!vueEnabled) {
          await legacyDrawProbe.evaluate((probe) => {
            probe.dataset.suppress = 'true'
            probe.textContent = ''
          })
          await comfyPage.nextFrame()

          let badgeAssertionFailed = false
          try {
            await expect(legacyDrawProbe).toHaveText(EXPECTED_PRICE, {
              timeout: 500
            })
          } catch {
            badgeAssertionFailed = true
          }
          expect(badgeAssertionFailed).toBe(true)

          await legacyDrawProbe.evaluate((probe) => {
            probe.dataset.suppress = 'false'
            window.app!.graph.setDirtyCanvas(true, true)
          })
          await comfyPage.nextFrame()
          await expect(legacyDrawProbe).toHaveText(EXPECTED_PRICE)
        }
      })
    }
  )
}
