import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReplacementResponse } from '@/platform/nodeReplacement/types'

/** Mock `/api/node_replacements` and enable the node replacement feature. */
export async function setupNodeReplacement(
  comfyPage: ComfyPage,
  replacements: NodeReplacementResponse
): Promise<void> {
  await comfyPage.page.route('**/api/node_replacements', (route) =>
    route.fulfill({ json: replacements })
  )

  await comfyPage.settings.setSetting(
    'Comfy.RightSidePanel.ShowErrorsTab',
    true
  )
  await comfyPage.settings.setSetting('Comfy.NodeReplacement.Enabled', true)

  await comfyPage.page.evaluate(() => {
    const api = window.app!.api
    api.serverFeatureFlags.value = {
      ...api.serverFeatureFlags.value,
      node_replacements: true
    }
  })
}

export function getSwapNodesGroup(page: Page): Locator {
  return page.getByTestId(TestIds.dialogs.swapNodesGroup)
}
