import type { GetExtensionsResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  V4_MODEL_LABEL,
  V4_PACK_SCRIPT,
  v4PackSource
} from '@e2e/fixtures/data/nodeApiV4Pack'

test.beforeEach(async ({ page }) => {
  await page.route('**/extensions', (route) =>
    route.fulfill({ json: [V4_PACK_SCRIPT] satisfies GetExtensionsResponse })
  )
  await page.route(`**${V4_PACK_SCRIPT}*`, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: v4PackSource })
  )
})

test.describe(
  'A pack importing /comfy/api/v4.js',
  { tag: ['@vue-nodes', '@node'] },
  () => {
    test('its onCreated hook labels the input slot of a node the user adds', async ({
      comfyPage
    }) => {
      const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId('KSampler', {
        position: { x: 400, y: 300 }
      })

      await expect(comfyPage.vueNodes.getInputSlotRow(nodeId, 0)).toHaveText(
        V4_MODEL_LABEL
      )
    })
  }
)
