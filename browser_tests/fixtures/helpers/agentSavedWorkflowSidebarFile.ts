import type { Page } from '@playwright/test'

import type { WorkflowSidebarFileResponse } from '@comfyorg/ingest-types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

interface SavedWorkflowPathSource {
  savedName: () => string | undefined
  savedContent: () => string | undefined
}

/** Models the cloud path lookup for agent fixtures that save through userdata. */
export async function mockAgentSavedWorkflowSidebarFile(
  page: Page,
  workflowId: string,
  saved: SavedWorkflowPathSource
): Promise<void> {
  await page.route(`**/api/workflows/${workflowId}/sidebar-file`, (route) => {
    const savedName = saved.savedName()
    if (savedName === undefined) return route.fulfill({ status: 409 })
    const sidebarFile: WorkflowSidebarFileResponse = {
      path: `workflows/${savedName}.json`,
      modified: Date.now(),
      size: saved.savedContent()?.length ?? 0
    }
    return route.fulfill(jsonRoute(sidebarFile))
  })
}
