import { mergeTests } from '@playwright/test'

import { AgentCanvasEntry } from '@e2e/fixtures/components/AgentCanvasEntry'
import {
  AGENT_ASK_RUN_MODE,
  AGENT_CANVAS_NODE_DEFINITIONS,
  EMPTY_AGENT_ASSETS,
  EMPTY_AGENT_THREADS,
  EMPTY_AGENT_WORKFLOWS
} from '@e2e/fixtures/data/agentCanvas'
import { installCustomNodeBlankStartup } from '@e2e/fixtures/utils/customNodeSuite'
import {
  expectNoVisibleErrors,
  trackVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import type { UploadImageResult } from '@/workbench/extensions/agent/schemas/agentApiSchema'

export const agentCanvasTest = mergeTests(agentTest, webSocketFixture).extend<{
  agentCanvas: AgentCanvasEntry
}>({
  page: async ({ page }, use) => {
    await installCustomNodeBlankStartup(page)
    await trackVisibleErrors(page)
    await page.route('**/api/settings/*', (route) =>
      route.fulfill({ status: 204 })
    )
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill({ json: EMPTY_AGENT_THREADS })
    )
    await page.route('**/api/object_info', (route) =>
      route.fulfill({ json: AGENT_CANVAS_NODE_DEFINITIONS })
    )
    await page.route('**/api/assets**', (route) =>
      route.fulfill({ json: EMPTY_AGENT_ASSETS })
    )
    await page.route(/\/api\/(?:agent\/)?workflows(?:\?|$)/, (route) =>
      route.fulfill({ json: EMPTY_AGENT_WORKFLOWS })
    )
    await page.route('**/api/agent/run-mode', (route) =>
      route.fulfill({ json: AGENT_ASK_RUN_MODE })
    )
    await page.route('**/api/view?*', (route) =>
      route.fulfill({ path: assetPath('test_upload_image.png') })
    )
    let uploadCount = 0
    await page.route('**/api/upload/image', (route) => {
      uploadCount += 1
      const image: UploadImageResult = {
        name: uploadCount === 1 ? 'uploaded_dog.png' : 'uploaded_sheep.png',
        subfolder: '',
        type: 'input'
      }
      return route.fulfill({ json: image })
    })
    await use(page)
  },
  agentCanvas: async ({ comfyPage }, use) => {
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await use(new AgentCanvasEntry(comfyPage))
    await expectNoVisibleErrors(comfyPage.page, 'Agent canvas entry')
    await comfyPage.canvasOps.resetView()
  }
})
