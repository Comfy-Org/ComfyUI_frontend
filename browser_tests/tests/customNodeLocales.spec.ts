import type { Page } from '@playwright/test'

import type { CustomNodesI18n } from '@/schemas/apiSchema'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const NODE_TYPE = 'DevToolsNodeWithStringInput'
const LOCALIZED_ZH = '本地化字符串输入 (ZH)'
const LOCALIZED_ZH_TW = '本地化字串輸入 (ZH-TW)'
const LOCALIZED_EN = 'Localized String Input (EN)'

async function routeCustomNodesI18n(page: Page, body: CustomNodesI18n) {
  await page.route('**/api/i18n', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })
}

test.describe(
  'Custom node locales loading',
  { tag: ['@ui', '@vue-nodes'] },
  () => {
    test.describe('shipped base tag', () => {
      test.use({ initialSettings: { 'Comfy.Locale': 'zh' } })

      test.beforeEach(async ({ page }) => {
        await routeCustomNodesI18n(page, {
          zh: { nodeDefs: { [NODE_TYPE]: { display_name: LOCALIZED_ZH } } }
        })
      })

      // Regression test for PR #7214 (issue #7025): custom-node i18n data was
      // clobbered when a non-English locale was lazily loaded, so nodes from
      // custom packs lost their translated display_name on locale switch.
      test('preserves custom-node /api/i18n translation through lazy locale load', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.addNode(NODE_TYPE)

        await expect(
          comfyPage.vueNodes.getNodeByTitle(LOCALIZED_ZH)
        ).toHaveCount(1)
      })
    })

    test.describe('unsupported tag clamps to en', () => {
      // Regression test for PR #11712 (issue #10563): when Comfy.Locale holds
      // an unsupported tag, the boundary helper clamps it to 'en'. Custom-node
      // 'en' translations must still merge into the active locale messages.
      test.use({ initialSettings: { 'Comfy.Locale': 'de' } })

      test.beforeEach(async ({ page }) => {
        await routeCustomNodesI18n(page, {
          en: { nodeDefs: { [NODE_TYPE]: { display_name: LOCALIZED_EN } } }
        })
      })

      test('renders en custom-node translation when locale clamps to en', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.addNode(NODE_TYPE)

        await expect(
          comfyPage.vueNodes.getNodeByTitle(LOCALIZED_EN)
        ).toHaveCount(1)
      })
    })

    test.describe('regional tag preserved', () => {
      // Regression test for PR #11712: full-tag match must beat base-tag
      // fallback, so a shipped regional tag like 'zh-TW' is not collapsed to
      // its base ('zh'). Both keys are present in the payload — the active
      // locale must merge the regional variant.
      test.use({ initialSettings: { 'Comfy.Locale': 'zh-TW' } })

      test.beforeEach(async ({ page }) => {
        await routeCustomNodesI18n(page, {
          zh: { nodeDefs: { [NODE_TYPE]: { display_name: LOCALIZED_ZH } } },
          'zh-TW': {
            nodeDefs: { [NODE_TYPE]: { display_name: LOCALIZED_ZH_TW } }
          }
        })
      })

      test('uses zh-TW custom-node translation, not zh base-tag fallback', async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.addNode(NODE_TYPE)

        await expect(
          comfyPage.vueNodes.getNodeByTitle(LOCALIZED_ZH_TW)
        ).toHaveCount(1)
      })
    })
  }
)
