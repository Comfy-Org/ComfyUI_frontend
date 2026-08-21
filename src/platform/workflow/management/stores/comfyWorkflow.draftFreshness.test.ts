/**
 * Regression: draft freshness must not be decided by comparing a
 * client-generated timestamp against a server-generated one.
 *
 * `ComfyWorkflow.load()` (comfyWorkflow.ts:120) discards a draft when
 * `draft.updatedAt < this.lastModified`. `draft.updatedAt` comes from the
 * browser's `Date.now()` at draft-save time, while `lastModified` comes from
 * the server. A client clock running behind the server therefore throws away
 * a draft that is genuinely newer than the saved workflow.
 */
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Pre-load the module graph that ComfyWorkflow.load() imports dynamically,
// so its one-time transform cost is not billed to the first test's timeout.
import '@/scripts/changeTracker'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'

import { ComfyWorkflow } from './comfyWorkflow'

const SERVER_CONTENT = JSON.stringify({
  id: 'server',
  nodes: [],
  links: [],
  revision: 0
})
const DRAFT_CONTENT = JSON.stringify({
  id: 'draft',
  nodes: [{ id: 1 }],
  links: [],
  revision: 1
})

vi.mock('@/scripts/api', () => ({
  api: {
    clientId: 'test-client',
    initialClientId: 'test-client',
    getUserData: vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      text: async () => SERVER_CONTENT
    }))
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    loadGraphData: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => (key === 'Comfy.Workflow.Persist' ? true : undefined)
  })
}))

/** Wall-clock instant, per the server, at which the workflow was last saved. */
const SERVER_SAVED_AT = Date.parse('2026-07-20T12:00:00.000Z')
/** The browser's clock runs five minutes behind the server. */
const CLIENT_SKEW_MS = 5 * 60 * 1000
/** The user edited 30 real seconds after the server save. */
const REAL_ELAPSED_MS = 30 * 1000

describe('ComfyWorkflow draft freshness under clock skew', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('keeps a draft written after the server save when the client clock lags', async () => {
    const path = 'workflows/skewed.json'
    const draftStore = useWorkflowDraftStoreV2()

    // The draft is written after the server save in real time, but the
    // browser stamps it with its own (lagging) clock.
    vi.setSystemTime(SERVER_SAVED_AT + REAL_ELAPSED_MS - CLIENT_SKEW_MS)
    expect(
      draftStore.saveDraft(path, DRAFT_CONTENT, {
        name: 'skewed',
        isTemporary: false
      })
    ).toBe(true)

    const workflow = new ComfyWorkflow({
      path,
      modified: SERVER_SAVED_AT,
      size: SERVER_CONTENT.length
    })

    const loaded = await workflow.load()

    // The draft is the newer edit and must win.
    expect(loaded.activeState).toEqual(JSON.parse(DRAFT_CONTENT))
    expect(loaded.isModified).toBe(true)
    // ...and must still be on disk for the next load.
    expect(draftStore.getDraft(path)).not.toBeNull()
  })

  // Control: proves the harness itself restores drafts when clocks agree,
  // so the failure above is attributable to the skew and nothing else.
  it('keeps a draft written after the server save when clocks agree', async () => {
    const path = 'workflows/aligned.json'
    const draftStore = useWorkflowDraftStoreV2()

    vi.setSystemTime(SERVER_SAVED_AT + REAL_ELAPSED_MS)
    expect(
      draftStore.saveDraft(path, DRAFT_CONTENT, {
        name: 'aligned',
        isTemporary: false
      })
    ).toBe(true)

    const workflow = new ComfyWorkflow({
      path,
      modified: SERVER_SAVED_AT,
      size: SERVER_CONTENT.length
    })

    const loaded = await workflow.load()

    expect(loaded.activeState).toEqual(JSON.parse(DRAFT_CONTENT))
    expect(loaded.isModified).toBe(true)
  })

  it('keeps a draft based on the current server revision when the client clock lags', async () => {
    const path = 'workflows/based-on-current.json'
    const draftStore = useWorkflowDraftStoreV2()

    vi.setSystemTime(SERVER_SAVED_AT + REAL_ELAPSED_MS - CLIENT_SKEW_MS)
    expect(
      draftStore.saveDraft(path, DRAFT_CONTENT, {
        name: 'based-on-current',
        isTemporary: false,
        baseLastModified: SERVER_SAVED_AT
      })
    ).toBe(true)

    const workflow = new ComfyWorkflow({
      path,
      modified: SERVER_SAVED_AT,
      size: SERVER_CONTENT.length
    })

    const loaded = await workflow.load()

    expect(loaded.activeState).toEqual(JSON.parse(DRAFT_CONTENT))
    expect(loaded.isModified).toBe(true)
    expect(draftStore.getDraft(path)).not.toBeNull()
  })

  it('discards a draft based on an older server revision even when the client clock runs ahead', async () => {
    const path = 'workflows/based-on-older.json'
    const draftStore = useWorkflowDraftStoreV2()

    // The server file was saved again (e.g. from another device) after the
    // revision this draft was based on. A fast client clock must not mask that.
    vi.setSystemTime(SERVER_SAVED_AT + CLIENT_SKEW_MS)
    expect(
      draftStore.saveDraft(path, DRAFT_CONTENT, {
        name: 'based-on-older',
        isTemporary: false,
        baseLastModified: SERVER_SAVED_AT - REAL_ELAPSED_MS
      })
    ).toBe(true)

    const workflow = new ComfyWorkflow({
      path,
      modified: SERVER_SAVED_AT,
      size: SERVER_CONTENT.length
    })

    const loaded = await workflow.load()

    expect(loaded.activeState).toEqual(JSON.parse(SERVER_CONTENT))
    expect(loaded.isModified).toBe(false)
    expect(draftStore.getDraft(path)).toBeNull()
  })
})
