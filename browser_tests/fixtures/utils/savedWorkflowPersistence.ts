import type { Page } from '@playwright/test'

import type { WorkflowListResponse } from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Captures every workflow save under `**\/api/userdata/*`, replays the exact
 * saved bytes back on a matching GET, reports the saved file in the
 * `**\/api/userdata?dir=workflows*` listing, and lists the most recently saved
 * workflow under `**\/api/workflows?*`, for the save/reopen round trip
 * `AgentConversationHarness.persistSavedWorkflow` needs. This is a separate
 * fake from `agentWorkflowSelectionFixture`'s own userdata mocking (which
 * keeps its own listing, GET/POST maps and lifecycle, and differs from this
 * one on missing-GET and deferred-save behavior) rather than a shared core
 * the two compose -- use this one for a spec that needs a real "reopen and
 * see the persisted content, not a draft" round trip.
 *
 * The listing is not optional. `workflowStore`'s `syncEntities` pass treats it
 * as the authority on which workflows exist: a saved path missing from it is
 * dropped from `openWorkflowPaths` after a reload, which empties the agent
 * panel's workflow picker (it lists `openWorkflows`) and leaves a reopen step
 * waiting on a menu item that can never appear.
 */
export async function mockSavedWorkflowPersistence(
  page: Page,
  workflowId: string
): Promise<{
  savedName: () => string | undefined
  /** The exact bytes the last save under `savedName()` posted. */
  savedContent: () => string | undefined
  /**
   * How many GETs this mock has answered with retained saved bytes. A reopen
   * that never increments it read the workflow from somewhere other than the
   * server.
   */
  servedContentGets: () => number
  /** Overwrites the bytes a later GET for the last-saved path serves. */
  corruptSavedContent: (content: string) => void
}> {
  const savedWorkflowContent = new Map<string, string>()
  const savedWorkflowInfo = new Map<string, UserDataFullInfo>()
  let savedName: string | undefined
  let servedContentGets = 0

  await page.route('**/api/userdata?*', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() !== 'GET') return route.fallback()
    if (url.searchParams.get('dir') !== 'workflows') return route.fallback()
    const listing: UserDataFullInfo[] = [...savedWorkflowInfo.values()].map(
      (info) => ({ ...info, path: info.path.slice('workflows/'.length) })
    )
    return route.fulfill(jsonRoute(listing))
  })

  await page.route('**/api/userdata/*', (route) => {
    const request = route.request()
    const path = decodeURIComponent(
      new URL(request.url()).pathname.split('/userdata/')[1]
    )
    if (!path.startsWith('workflows/')) return route.fallback()
    if (request.method() === 'GET') {
      const content = savedWorkflowContent.get(path)
      if (content === undefined) return route.fallback()
      servedContentGets++
      return route.fulfill({ contentType: 'application/json', body: content })
    }
    if (request.method() !== 'POST') return route.fallback()
    savedName = path.slice('workflows/'.length, -'.json'.length)
    const body = request.postData() ?? '{}'
    savedWorkflowContent.set(path, body)
    const saved: UserDataFullInfo = {
      path,
      modified: Date.now(),
      size: request.postDataBuffer()?.length ?? 0
    }
    savedWorkflowInfo.set(path, saved)
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
    servedContentGets: () => servedContentGets,
    corruptSavedContent: (content) => {
      if (savedName === undefined) {
        throw new Error('no workflow has been saved yet')
      }
      savedWorkflowContent.set(`workflows/${savedName}.json`, content)
    }
  }
}
