import type { Page } from '@playwright/test'

import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Captures every workflow save under `**\/api/userdata/*` and replays the
 * exact saved bytes back on a matching GET, plus lists the most recently
 * saved workflow under `**\/api/workflows?*` -- the save/reopen round trip
 * `AgentConversationHarness.persistSavedWorkflow` and
 * `agentWorkflowSelectionFixture` already own. Shared here instead of a
 * third hand-rolled copy, so a spec that needs a real "reopen and see the
 * persisted content, not a draft" round trip composes this rather than
 * re-implementing it.
 */
export async function mockSavedWorkflowPersistence(
  page: Page,
  workflowId: string
): Promise<{
  savedName: () => string | undefined
  /** The exact bytes the last save under `savedName()` posted. */
  savedContent: () => string | undefined
  /** Overwrites the bytes a later GET for the last-saved path serves. */
  corruptSavedContent: (content: string) => void
}> {
  const savedWorkflowContent = new Map<string, string>()
  let savedName: string | undefined

  await page.route('**/api/userdata/*', (route) => {
    const request = route.request()
    const path = decodeURIComponent(
      new URL(request.url()).pathname.split('/userdata/')[1]
    )
    if (!path.startsWith('workflows/')) return route.fallback()
    if (request.method() === 'GET') {
      const content = savedWorkflowContent.get(path)
      return content === undefined
        ? route.fallback()
        : route.fulfill({ contentType: 'application/json', body: content })
    }
    if (request.method() !== 'POST') return route.fallback()
    savedName = path.slice('workflows/'.length, -'.json'.length)
    savedWorkflowContent.set(path, request.postData() ?? '{}')
    const saved: UserDataFullInfo = {
      path,
      modified: Date.now(),
      size: request.postDataBuffer()?.length ?? 0
    }
    return route.fulfill(jsonRoute(saved))
  })

  await page.route('**/api/workflows?*', (route) => {
    const workflows: WorkflowListResponse = {
      data:
        savedName === undefined
          ? []
          : [
              {
                id: workflowId,
                name: savedName,
                created_at: '2026-09-01T00:00:00Z',
                updated_at: '2026-09-01T00:00:00Z',
                created_by: 'test-user-e2e',
                latest_version: 1
              }
            ],
      pagination: {
        has_more: false,
        limit: 100,
        offset: 0,
        total: savedName === undefined ? 0 : 1
      }
    }
    return route.fulfill(jsonRoute(workflows))
  })

  return {
    savedName: () => savedName,
    savedContent: () =>
      savedName === undefined
        ? undefined
        : savedWorkflowContent.get(`workflows/${savedName}.json`),
    corruptSavedContent: (content) => {
      if (savedName === undefined) {
        throw new Error('no workflow has been saved yet')
      }
      savedWorkflowContent.set(`workflows/${savedName}.json`, content)
    }
  }
}
