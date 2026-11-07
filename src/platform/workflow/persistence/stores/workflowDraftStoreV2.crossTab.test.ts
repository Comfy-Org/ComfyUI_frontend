/**
 * Two browser tabs on one workspace, interleaved *without* a reload.
 *
 * A tab caches its draft index in memory and never re-reads it, so a second
 * tab keeps resolving slots from the index it loaded at startup. Preserving a
 * renamed draft's slot (so a rename allocates no payload — see `moveEntry`)
 * means a slot no longer implies `hashPath(path)`, and a tab that missed the
 * rename must therefore not read, overwrite or delete that slot as its own.
 *
 * The other tab appears here as the index and payload writes it leaves in
 * shared storage, which is the only channel between two tabs. A second store
 * instance is not available in this project: `vitest.setup.ts` installs a
 * testing Pinia, and under `NODE_ENV=test` Pinia discards an explicitly passed
 * Pinia while a testing one is active (`pinia.js:1304`), so
 * `useWorkflowDraftStoreV2(otherPinia)` returns the same store.
 */
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
/** The slot `resolveDraftKey` falls back to for A once `SLOT_A` is taken. */
const SLOT_A_FALLBACK = `${SLOT_A}:${PATH_A}`
const PAYLOAD_PREFIX = `${StorageKeys.prefixes.draftPayload}${WORKSPACE}:`

const GRAPH_A = '{"nodes":["a"]}'
const GRAPH_A_EDITED = '{"nodes":["a","a2"]}'
const GRAPH_C = '{"nodes":["c"]}'
const META_A = { name: 'alpha', isTemporary: false }

/** The index another tab persists when it renames A to B. */
function indexAfterOtherTabRenames(): DraftIndexV2 {
  const moved = moveEntry(readIndex(WORKSPACE)!, PATH_A, PATH_B, 'beta')
  return moved!.index
}

/**
 * The index another tab persists when it renames A to B, saves a second A —
 * which lands on the fallback slot, A's own being taken — and renames that one
 * to C. Both of the slots this tab would choose for A are now owned by a
 * different path.
 */
function indexAfterOtherTabRenameChain(): DraftIndexV2 {
  const resaved = upsertEntry(indexAfterOtherTabRenames(), PATH_A, {
    ...META_A,
    updatedAt: Date.now()
  }).index
  return moveEntry(resaved, PATH_A, PATH_C, 'gamma')!.index
}

/** The index another tab persists when it autosaves A from `stale`. */
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
  /**
   * This tab saved A and still has it cached; the other tab renamed A to a
   * differently-hashed B, which keeps B on A's slot. This tab's next autosave
   * of A must not land on that slot — both drafts have to survive.
   */
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

  /**
   * Adopting a contended slot has to settle, not take one step. Here the other
   * tab's rename chain owns *both* slots this tab would pick for A: importing
   * only the first owner leaves the fallback looking free, so A's autosave
   * lands on the draft parked there and drops it from the index.
   */
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

  /** The same interleaving must not stamp A's CRDT lineage onto B. */
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

  /** Nor delete it: discarding A's draft must leave B's payload alone. */
  it('does not delete a renamed draft when removing the old path', () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)

    writeIndex(WORKSPACE, indexAfterOtherTabRenames())

    store.removeDraft(PATH_A)

    expect(readPayload(WORKSPACE, SLOT_A)?.data).toBe(GRAPH_A)
  })

  /**
   * The read side of the same race: this tab did the rename, so it has B on
   * A's slot cached, and the other tab then autosaved A onto that slot from
   * its own stale index. Loading B must not hand the restore caller A's graph.
   */
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

  /** Renaming the old path must not re-point the slot B now holds either. */
  it('does not claim a renamed draft slot when renaming the old path', () => {
    const store = useWorkflowDraftStoreV2()
    store.saveDraft(PATH_A, GRAPH_A, META_A)

    writeIndex(WORKSPACE, indexAfterOtherTabRenames())

    store.moveDraft(PATH_A, PATH_C, 'gamma')

    expect(readIndex(WORKSPACE)?.entries[SLOT_A]?.path).toBe(PATH_B)
    expect(readPayload(WORKSPACE, SLOT_A)?.data).toBe(GRAPH_A)
  })

  /**
   * Adopting a contended slot makes a lineage park by path, which a rename of
   * that path then has to carry: the next workflow saved at the old path is a
   * different one and must not inherit it.
   */
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

  /**
   * The guarantee the slot-preserving rename exists for: a rename allocates no
   * payload, so a full device cannot fail it after the file was already
   * renamed. None of the above may reintroduce that write.
   */
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
