import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import type { DraftIndexV2 } from '@/platform/workflow/persistence/base/draftTypes'
import {
  moveEntry,
  upsertEntry
} from '@/platform/workflow/persistence/base/draftCacheV2'
import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'
import {
  readIndex,
  readPayload,
  resetStorageAvailable,
  writeIndex,
  writePayload
} from '@/platform/workflow/persistence/base/storageIO'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { useWorkflowDraftStoreV2 } from './workflowDraftStoreV2'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

const WORKSPACE = 'personal'
const PATH_A = 'workflows/alpha.json'
const PATH_B = 'workflows/beta.json'
const PATH_C = 'workflows/gamma.json'
const SLOT_A = hashPath(PATH_A)
const SLOT_A_FALLBACK = `${SLOT_A}:${PATH_A}`
const PAYLOAD_PREFIX = `${StorageKeys.prefixes.draftPayload}${WORKSPACE}:`

const GRAPH_A = '{"nodes":["a"]}'
const GRAPH_A_EDITED = '{"nodes":["a","a2"]}'
const GRAPH_C = '{"nodes":["c"]}'
const META_A = { name: 'alpha', isTemporary: false }

function indexAfterOtherTabRenames(): DraftIndexV2 {
  const moved = moveEntry(readIndex(WORKSPACE)!, PATH_A, PATH_B, 'beta')
  return moved!.index
}

function indexAfterOtherTabRenameChain(): DraftIndexV2 {
  const resaved = upsertEntry(indexAfterOtherTabRenames(), PATH_A, {
    ...META_A,
    updatedAt: Date.now()
  }).index
  return moveEntry(resaved, PATH_A, PATH_C, 'gamma')!.index
}

function indexAfterOtherTabSaves(stale: DraftIndexV2): DraftIndexV2 {
  return upsertEntry(stale, PATH_A, { ...META_A, updatedAt: Date.now() }).index
}

let setItemSpy: MockInstance | null = null

function countPayloadWrites(): number {
  return (
    setItemSpy?.mock.calls.filter(([key]) =>
      String(key).startsWith(PAYLOAD_PREFIX)
    ).length ?? 0
  )
}

beforeEach(() => {
  api.clientId = 'test-client'
  api.initialClientId = 'test-client'
  localStorage.clear()
  sessionStorage.clear()
  resetStorageAvailable()
  setItemSpy = null
})

afterEach(() => {
  setItemSpy = null
  localStorage.clear()
  sessionStorage.clear()
})

describe('workflowDraftStoreV2 across two live tabs', () => {
  it('does not overwrite a renamed draft when autosaving the old path', () => {
    const store = useWorkflowDraftStoreV2()
    expect(store.saveDraft(PATH_A, GRAPH_A, META_A)).toBe(true)

    writeIndex(WORKSPACE, indexAfterOtherTabRenames())

    expect(store.saveDraft(PATH_A, GRAPH_A_EDITED, META_A)).toBe(true)

    expect(readPayload(WORKSPACE, SLOT_A)?.data).toBe(GRAPH_A)
    store.reset()
    expect(store.getDraft(PATH_B)).toMatchObject({
      data: GRAPH_A,
      name: 'beta'
    })
    expect(store.getDraft(PATH_A)).toMatchObject({ data: GRAPH_A_EDITED })
  })

  it('does not overwrite a draft parked on the fallback slot', () => {
    const store = useWorkflowDraftStoreV2()
    expect(store.saveDraft(PATH_A, GRAPH_A, META_A)).toBe(true)

    writeIndex(WORKSPACE, indexAfterOtherTabRenameChain())
    writePayload(WORKSPACE, SLOT_A_FALLBACK, {
      data: GRAPH_C,
      updatedAt: Date.now()
    })

    expect(store.saveDraft(PATH_A, GRAPH_A_EDITED, META_A)).toBe(true)

    expect(readPayload(WORKSPACE, SLOT_A)?.data).toBe(GRAPH_A)
    expect(readPayload(WORKSPACE, SLOT_A_FALLBACK)?.data).toBe(GRAPH_C)
    store.reset()
    expect(store.getDraft(PATH_B)).toMatchObject({
      data: GRAPH_A,
      name: 'beta'
    })
    expect(store.getDraft(PATH_C)).toMatchObject({
      data: GRAPH_C,
      name: 'gamma'
    })
    expect(store.getDraft(PATH_A)).toMatchObject({ data: GRAPH_A_EDITED })
  })

  it('does not stamp a renamed draft with the old path lineage', () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)

    writeIndex(WORKSPACE, indexAfterOtherTabRenames())

    store.setLineage(PATH_A, { workflowId: 'wf-a', lineageSeq: 9 })
    store.saveDraft(PATH_A, GRAPH_A_EDITED, META_A)

    expect(readPayload(WORKSPACE, SLOT_A)?.lineage).toBeUndefined()
    store.reset()
    expect(store.getDraft(PATH_B)?.lineage).toBeUndefined()
    expect(store.getDraft(PATH_A)?.lineage).toEqual({
      workflowId: 'wf-a',
      lineageSeq: 9
    })
  })

  it('does not delete a renamed draft when removing the old path', () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)

    writeIndex(WORKSPACE, indexAfterOtherTabRenames())

    store.removeDraft(PATH_A)

    expect(readPayload(WORKSPACE, SLOT_A)?.data).toBe(GRAPH_A)
  })

  it('refuses a renamed draft whose slot another tab took back', async () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)
    const beforeRename = readIndex(WORKSPACE)!

    store.moveDraft(PATH_A, PATH_B, 'beta')

    writePayload(WORKSPACE, SLOT_A, {
      data: GRAPH_A_EDITED,
      updatedAt: Date.now()
    })
    writeIndex(WORKSPACE, indexAfterOtherTabSaves(beforeRename))

    expect(store.getDraft(PATH_B)).toBeNull()

    const { app } = await import('@/scripts/app')
    vi.mocked(app.loadGraphData).mockClear()
    expect(await store.loadPersistedWorkflow({ preferredPath: PATH_B })).toBe(
      false
    )
    expect(app.loadGraphData).not.toHaveBeenCalled()
  })

  it('does not claim a renamed draft slot when renaming the old path', () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)

    writeIndex(WORKSPACE, indexAfterOtherTabRenames())

    store.moveDraft(PATH_A, PATH_C, 'gamma')

    expect(readIndex(WORKSPACE)?.entries[SLOT_A]?.path).toBe(PATH_B)
    expect(readPayload(WORKSPACE, SLOT_A)?.data).toBe(GRAPH_A)
  })

  it('moves a parked lineage with the rename, not onto the next workflow', () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)

    writeIndex(WORKSPACE, indexAfterOtherTabRenames())

    store.setLineage(PATH_A, { workflowId: 'wf-a', lineageSeq: 9 })
    store.moveDraft(PATH_A, PATH_C, 'gamma')

    store.saveDraft(PATH_C, GRAPH_A, { name: 'gamma', isTemporary: false })
    store.saveDraft(PATH_A, GRAPH_A_EDITED, { name: 'new', isTemporary: false })

    expect(store.getDraft(PATH_A)?.lineage).toBeUndefined()
    expect(store.getDraft(PATH_C)?.lineage).toEqual({
      workflowId: 'wf-a',
      lineageSeq: 9
    })
  })

  it('allocates no payload when an ordinary rename keeps its slot', () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)

    const realSetItem = localStorage.setItem.bind(localStorage)
    setItemSpy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key: string, value: string) =>
        realSetItem(key, value)
      )

    store.moveDraft(PATH_A, PATH_B, 'beta')

    expect(countPayloadWrites()).toBe(0)
  })
})
