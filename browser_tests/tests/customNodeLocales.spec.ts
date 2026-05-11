import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { CustomNodesI18n } from '@/schemas/apiSchema'

const NODE_TYPE = 'DevToolsNodeWithStringInput'
const LOCALIZED_ZH = '本地化字符串输入 (ZH)'

const i18nResponse: CustomNodesI18n = {
  zh: {
    nodeDefs: {
      [NODE_TYPE]: { display_name: LOCALIZED_ZH }
    }
  }
}

test.describe(
  'Custom node locales loading',
  { tag: ['@ui', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/i18n', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(i18nResponse)
        })
      })
    })

    // Regression test for PR #7214 (issue #7025): custom-node i18n data was
    // clobbered when a non-English locale was lazily loaded, so nodes from
    // custom packs lost their translated display_name on locale switch.
    test('preserves custom-node /api/i18n translation through lazy locale load', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Locale', 'zh')

      await comfyPage.nodeOps.addNode(NODE_TYPE)

      await expect(comfyPage.vueNodes.getNodeByTitle(LOCALIZED_ZH)).toHaveCount(
        1
      )
    })
  }
)
