import { fromPartial } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ComfyWorkflow,
  LoadedComfyWorkflow
} from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

vi.mock('@/scripts/app', () => ({ app: { canvas: {} } }))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: () => {},
    getUserData: async () => ({ status: 404 }),
    storeUserData: async () => {}
  }
}))

vi.mock('@/renderer/core/thumbnail/useWorkflowThumbnail', () => ({
  useWorkflowThumbnail: () => ({
    moveWorkflowThumbnail: () => {},
    clearThumbnail: () => {}
  })
}))

vi.mock('@/platform/workflow/persistence/stores/workflowDraftStoreV2', () => ({
  useWorkflowDraftStoreV2: () => ({
    getDraft: () => null,
    saveDraft: () => {},
    deleteDraft: () => {}
  })
}))

function wf(path: string): ComfyWorkflow {
  const workflow = fromPartial<ComfyWorkflow>({
    path,
    load: async () => workflow as LoadedComfyWorkflow
  })
  return workflow
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('workflowStore tab management', () => {
  it('attaches workflows into the lookup and finds them by path', () => {
    const store = useWorkflowStore()
    const a = wf('a.json')
    store.attachWorkflow(a)

    // Pinia wraps stored objects in reactive proxies, so compare structurally.
    expect(store.getWorkflowByPath('a.json')).toEqual(a)
    expect(store.getWorkflowByPath('missing.json')).toBeNull()
    expect(store.workflows).toContainEqual(a)
  })

  it('tracks which workflows are open', () => {
    const store = useWorkflowStore()
    const open = wf('open.json')
    const closed = wf('closed.json')
    store.attachWorkflow(open, 0)
    store.attachWorkflow(closed)

    expect(store.isOpen(open)).toBe(true)
    expect(store.isOpen(closed)).toBe(false)
    expect(store.openWorkflows).toEqual([open])
  })

  it('reorders open workflow tabs', () => {
    const store = useWorkflowStore()
    const a = wf('a.json')
    const b = wf('b.json')
    const c = wf('c.json')
    store.attachWorkflow(a, 0)
    store.attachWorkflow(b, 1)
    store.attachWorkflow(c, 2)

    store.reorderWorkflows(0, 2)

    expect(store.openWorkflows).toEqual([b, c, a])
  })

  it('opens background workflows on the requested side, ignoring unknown paths', () => {
    const store = useWorkflowStore()
    const left = wf('left.json')
    const mid = wf('mid.json')
    const right = wf('right.json')
    store.attachWorkflow(left)
    store.attachWorkflow(mid, 0)
    store.attachWorkflow(right)

    store.openWorkflowsInBackground({
      left: ['left.json', 'unknown.json'],
      right: ['right.json']
    })

    expect(store.openWorkflows).toEqual([left, mid, right])
  })

  it('marks a workflow active only after it is opened', async () => {
    const store = useWorkflowStore()
    const opened = wf('opened.json')
    const background = wf('background.json')
    store.attachWorkflow(opened)
    store.attachWorkflow(background)

    expect(store.isActive(opened)).toBe(false)

    await store.openWorkflow(opened)

    expect(store.isActive(opened)).toBe(true)
    expect(store.isActive(background)).toBe(false)
  })
})
