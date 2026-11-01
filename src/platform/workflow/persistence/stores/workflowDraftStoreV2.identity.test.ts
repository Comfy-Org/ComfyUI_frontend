import { beforeEach, describe, expect, it } from 'vitest'

import {
  resetStorageAvailable,
  setStorageIdentity,
  setStorageWorkspaceId
} from '@/platform/workflow/persistence/base/storageIO'

import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

describe('workflow draft identity scope', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetStorageAvailable()
    setStorageWorkspaceId('personal')
  })

  it('does not restore or overwrite another authenticated subject draft', () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/private.json'
    setStorageIdentity('account-a')

    store.saveDraft(path, '{"owner":"a"}', {
      name: 'private',
      isTemporary: true
    })
    setStorageIdentity('account-b')

    expect(store.getDraft(path)).toBeNull()
    store.saveDraft(path, '{"owner":"b"}', {
      name: 'private',
      isTemporary: true
    })

    expect(store.getDraft(path)?.data).toBe('{"owner":"b"}')
    setStorageIdentity('account-a')
    expect(store.getDraft(path)?.data).toBe('{"owner":"a"}')
  })
})
