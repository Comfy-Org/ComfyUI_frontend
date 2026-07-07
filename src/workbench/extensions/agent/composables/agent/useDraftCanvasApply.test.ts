import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { DraftPatchData } from '../../schemas/agentApiSchema'
import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'

import { useDraftCanvasApply } from './useDraftCanvasApply'

const WF = 'wf-1'

function patch(version: number): DraftPatchData {
  return {
    workflow_id: WF,
    base_version: version - 1,
    version,
    content: { nodes: [{ id: version }] }
  }
}

describe('useDraftCanvasApply', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('applies each newly adopted draft version with its content', async () => {
    const store = useAgentDraftStore()
    store.bind(WF)
    const apply = vi.fn()
    useDraftCanvasApply(apply)

    store.adoptSnapshot({ content: { nodes: [] }, version: 5 })
    await nextTick()
    store.applyPatch(patch(6))
    await nextTick()

    expect(apply.mock.calls).toEqual([
      [{ nodes: [] }, 5],
      [{ nodes: [{ id: 6 }] }, 6]
    ])
  })

  it('does not fire for rejected (stale or foreign) patches', async () => {
    const store = useAgentDraftStore()
    store.bind(WF)
    store.adoptSnapshot({ content: {}, version: 9 })
    const apply = vi.fn()
    useDraftCanvasApply(apply)

    store.applyPatch(patch(9))
    store.applyPatch({ ...patch(10), workflow_id: 'other' })
    await nextTick()

    expect(apply).not.toHaveBeenCalled()
  })

  it('does not fire with null content when the store resets or rebinds', async () => {
    const store = useAgentDraftStore()
    store.bind(WF)
    store.adoptSnapshot({ content: {}, version: 3 })
    const apply = vi.fn()
    useDraftCanvasApply(apply)

    store.reset()
    await nextTick()
    store.bind('wf-2')
    await nextTick()

    expect(apply).not.toHaveBeenCalled()
  })

  it('stops applying after the returned stop handle runs', async () => {
    const store = useAgentDraftStore()
    store.bind(WF)
    const apply = vi.fn()
    const stop = useDraftCanvasApply(apply)

    stop()
    store.applyPatch(patch(1))
    await nextTick()

    expect(apply).not.toHaveBeenCalled()
  })
})
