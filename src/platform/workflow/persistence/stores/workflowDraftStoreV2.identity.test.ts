import { beforeEach, describe, expect, it, vi } from 'vitest'

import { registerUserFileScopeProvider } from '@/platform/workflow/core/services/userFileContext'

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
  it('refuses to replace a known-ID draft with unknown or different-ID state', () => {
    const store = useWorkflowDraftStoreV2()
    const identity = {
      id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      ownerId: 'user-1',
      workspaceId: 'ws-1'
    }
    registerUserFileScopeProvider(() => identity)
    const path = 'workflows/private.json'
    const meta = {
      name: 'private',
      isTemporary: false,
      savedFileIdentity: identity
    }
    expect(store.saveDraft(path, '{"keep":"original"}', meta)).toBe(true)
    const before = store.getDraft(path)
    expect(
      store.saveDraft(path, '{"overwrite":true}', {
        name: 'private',
        isTemporary: false
      })
    ).toBe(false)
    expect(
      store.saveDraft(path, '{"overwrite":true}', {
        ...meta,
        savedFileIdentity: {
          ...identity,
          id: '78ebcb5b-028d-45e8-9f9c-b20f433c364d'
        }
      })
    ).toBe(false)
    expect(store.getDraft(path)).toEqual(before)
  })
  it('keeps an identified draft at the old alias when the new index cannot persist', () => {
    const store = useWorkflowDraftStoreV2()
    const identity = {
      id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      ownerId: 'user-1',
      workspaceId: 'ws-1'
    }
    store.saveDraft('workflows/old.json', '{"keep":true}', {
      name: 'old',
      isTemporary: false,
      savedFileIdentity: identity
    })
    const before = store.getDraft('workflows/old.json')
    const write = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.startsWith('Comfy.Workflow.DraftIndex.v2:'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      write(key, value)
    })
    expect(
      store.moveDraft('workflows/old.json', 'workflows/new.json', 'new')
    ).toBe(false)
    expect(store.getDraft('workflows/old.json')).toEqual(before)
    expect(store.getDraft('workflows/new.json')).toBeNull()
  })

  it('keeps the payload and identity during a no-op alias move', () => {
    const store = useWorkflowDraftStoreV2()
    const identity = {
      id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      ownerId: 'user-1',
      workspaceId: 'ws-1'
    }
    store.saveDraft('workflows/same.json', '{"keep":true}', {
      name: 'same',
      isTemporary: false,
      savedFileIdentity: identity
    })
    const before = store.getDraft('workflows/same.json')
    expect(
      store.moveDraft('workflows/same.json', 'workflows/same.json', 'same')
    ).toBe(true)
    expect(store.getDraft('workflows/same.json')).toEqual(before)
  })

  it('moves the same-ID draft alias before persisting edits at its renamed path', () => {
    const store = useWorkflowDraftStoreV2()
    const identity = {
      id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      ownerId: 'user-1',
      workspaceId: 'ws-1'
    }
    const meta = {
      name: 'old',
      isTemporary: false,
      savedFileIdentity: identity
    }
    store.saveDraft('workflows/old.json', '{"old":true}', meta)
    expect(
      store.saveDraft('workflows/new.json', '{"latest":true}', {
        ...meta,
        name: 'new'
      })
    ).toBe(true)
    expect(store.getDraft('workflows/old.json')).toBeNull()
    expect(store.getDraft('workflows/new.json')?.data).toBe('{"latest":true}')
    expect(store.getDraft('workflows/new.json')?.savedFileIdentity).toEqual(
      identity
    )
  })
})
