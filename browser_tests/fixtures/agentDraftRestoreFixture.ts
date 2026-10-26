import type { Page } from '@playwright/test'

import type {
  DraftIndexV2,
  DraftPayloadV2
} from '@/platform/workflow/persistence/base/draftTypes'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import type { WorkspaceStore } from '@e2e/types/globals'

export async function seedAgentDraftLineage(
  page: Page,
  workflowId: string,
  lineageSeq: number
): Promise<void> {
  const draft = await page.evaluate(() => {
    const app = window.app!
    const activeWorkflow = (app.extensionManager as WorkspaceStore).workflow
      .activeWorkflow
    if (!activeWorkflow) throw new Error('no active workflow to seed')
    return {
      path: activeWorkflow.path,
      name: activeWorkflow.key,
      data: JSON.stringify(app.rootGraph.serialize())
    }
  })
  const scope = `${encodeURIComponent('test-user-e2e')}:personal`
  const draftKey = hashPath(draft.path)
  const now = Date.now()
  const index: DraftIndexV2 = {
    v: 2,
    updatedAt: now,
    order: [draftKey],
    entries: {
      [draftKey]: {
        path: draft.path,
        name: draft.name,
        isTemporary: true,
        updatedAt: now
      }
    }
  }
  const payload: DraftPayloadV2 = {
    data: draft.data,
    updatedAt: now,
    lineage: { workflowId, lineageSeq }
  }
  await page.evaluate(
    ({ indexKey, payloadKey, index, payload }) => {
      localStorage.setItem(indexKey, JSON.stringify(index))
      localStorage.setItem(payloadKey, JSON.stringify(payload))
    },
    {
      indexKey: StorageKeys.draftIndex(scope),
      payloadKey: StorageKeys.draftPayload(draft.path, scope),
      index,
      payload
    }
  )
  await page.evaluate(() => {
    const draftStore = document
      .getElementById('vue-app')
      ?.__vue_app__?.config.globalProperties.$pinia._s.get('workflowDraftV2')
    if (!draftStore) throw new Error('workflow draft store is not mounted')
    draftStore.reset()
  })
}

export async function readAgentDraftLineage(
  page: Page
): Promise<DraftPayloadV2['lineage'] | null> {
  return page.evaluate(() => {
    const path = (window.app!.extensionManager as WorkspaceStore).workflow
      .activeWorkflow?.path
    const draftStore = document
      .getElementById('vue-app')
      ?.__vue_app__?.config.globalProperties.$pinia._s.get('workflowDraftV2')
    if (!path || !draftStore) throw new Error('no active workflow draft')
    return draftStore.getDraft(path)?.lineage ?? null
  })
}
