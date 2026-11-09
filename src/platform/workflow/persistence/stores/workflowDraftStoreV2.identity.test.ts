import { beforeEach, describe, expect, it } from 'vitest'

import { resetStorageAvailable } from '@/platform/workflow/persistence/base/storageIO'

import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

describe('workflow draft identity scope', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    resetStorageAvailable()
  })

  it('does not restore or overwrite another authenticated subject draft', () => {
    const store = useWorkflowDraftStoreV2()
    const path = 'workflows/private.json'
    store.setAuthSubject('account-a')

    store.saveDraft(path, '{"owner":"a"}', {
      name: 'private',
      isTemporary: true
    })
    store.setAuthSubject('account-b')

    expect(store.getDraft(path)).toBeNull()
    store.saveDraft(path, '{"owner":"b"}', {
      name: 'private',
      isTemporary: true
    })

    expect(store.getDraft(path)?.data).toBe('{"owner":"b"}')
    store.setAuthSubject('account-a')
    expect(store.getDraft(path)?.data).toBe('{"owner":"a"}')
  })
})
