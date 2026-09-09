import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { hashPath } from '../base/hashUtil'
import { readIndex, setStorageIdentity } from '../base/storageIO'
import { StorageKeys } from '../base/storageKeys'
import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { clientId: 'test-client', initialClientId: 'test-client' }
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { loadGraphData: vi.fn().mockResolvedValue(undefined) }
}))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const PATH = 'workflows/test.json'
const META = { name: 'test', isTemporary: false }

describe('workflowDraftStoreV2 storage scope', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setActivePinia(createPinia())
    setStorageIdentity(null)
  })

  it('reads nothing and leaves storage untouched while the scope is unresolved', () => {
    localStorage.setItem(
      StorageKeys.draftPayload(PATH, 'personal'),
      JSON.stringify({ data: '{}', updatedAt: 1 })
    )
    localStorage.setItem(
      StorageKeys.draftIndex('personal'),
      JSON.stringify({
        entries: { [hashPath(PATH)]: { path: PATH, ...META } },
        order: [hashPath(PATH)]
      })
    )
    const store = useWorkflowDraftStoreV2()

    expect(store.getDraft(PATH)).toBeNull()
    expect(store.getMostRecentPath()).toBeNull()
    store.removeDraft(PATH)

    expect(localStorage.length).toBe(2)
  })

  it('keys drafts by the resolved user scope, not the bare workspace', () => {
    setStorageIdentity('user-a')
    const store = useWorkflowDraftStoreV2()

    expect(store.saveDraft(PATH, '{"a":1}', META)).toBe(true)

    expect(readIndex('user-a:personal')?.order).toEqual([hashPath(PATH)])
    expect(readIndex('personal')).toBeNull()
    expect(
      localStorage.getItem(StorageKeys.draftPayload(PATH, 'user-a:personal'))
    ).not.toBeNull()
  })

  it('serves each user their own drafts after identity changes', () => {
    setStorageIdentity('user-a')
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH, '{"owner":"a"}', META)

    setStorageIdentity('user-b')
    expect(store.getDraft(PATH)).toBeNull()
    store.saveDraft(PATH, '{"owner":"b"}', META)

    setStorageIdentity('user-a')
    expect(store.getDraft(PATH)?.data).toBe('{"owner":"a"}')
  })
})
