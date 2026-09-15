import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { mergeTests } from '@playwright/test'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

export const referenceNode: ComfyNodeDef = {
  name: 'ColorBalance',
  display_name: 'Color balance',
  description: 'A node used to verify scoped Agent references.',
  category: 'image',
  python_module: 'tests.color_balance',
  output_node: false,
  input: { required: {} },
  output: []
}

export const referenceWorkflow: ComfyWorkflowJSON = {
  last_node_id: 12,
  last_link_id: 0,
  version: 0.4,
  nodes: [
    {
      id: 12,
      type: 'ColorBalance',
      pos: [400, 250],
      size: [240, 80],
      flags: {},
      order: 0,
      mode: 0,
      properties: {}
    }
  ],
  links: []
}

const base = mergeTests(agentTest, workflowSelectionTest, webSocketFixture)

export const inlineReferencesTest = base.extend<{
  assetUpload: { finish: () => void }
}>({
  assetUpload: async ({ page }, use) => {
    let finish = () => {}
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const response: UploadImageResponse = {
      name: 'reference.png',
      subfolder: '',
      type: 'input'
    }
    await page.route('**/api/upload/image', async (route) => {
      await pending
      return route.fulfill(jsonRoute(response))
    })
    await use({ finish })
    finish()
  }
})
