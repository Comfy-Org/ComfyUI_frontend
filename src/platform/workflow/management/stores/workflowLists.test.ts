import { fromPartial } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

vi.mock('@/scripts/app', () => ({ app: {} }))

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

interface WorkflowFlags {
  path: string
  isPersisted?: boolean
  isModified?: boolean
}

function wf(flags: WorkflowFlags): ComfyWorkflow {
  return fromPartial<ComfyWorkflow>(flags)
}

function paths(workflows: ComfyWorkflow[]) {
  return workflows.map((w) => w.path)
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('workflowStore workflow lists', () => {
  it('persistedWorkflows excludes unpersisted and subgraph entries', () => {
    const store = useWorkflowStore()
    store.attachWorkflow(wf({ path: 'a.json', isPersisted: true }))
    store.attachWorkflow(wf({ path: 'b.json', isPersisted: false }))
    store.attachWorkflow(wf({ path: 'subgraphs/c.json', isPersisted: true }))

    expect(paths(store.persistedWorkflows)).toEqual(['a.json'])
  })

  it('modifiedWorkflows includes only modified workflows', () => {
    const store = useWorkflowStore()
    store.attachWorkflow(wf({ path: 'a.json', isModified: true }))
    store.attachWorkflow(wf({ path: 'b.json', isModified: false }))

    expect(paths(store.modifiedWorkflows)).toEqual(['a.json'])
  })

  it('bookmarkedWorkflows is empty when nothing is bookmarked', () => {
    const store = useWorkflowStore()
    store.attachWorkflow(wf({ path: 'a.json' }))

    expect(store.bookmarkedWorkflows).toEqual([])
  })

  it('openedWorkflowIndexShift returns null when no workflow is active', () => {
    const store = useWorkflowStore()
    store.attachWorkflow(wf({ path: 'a.json' }), 0)

    expect(store.openedWorkflowIndexShift(1)).toBeNull()
  })
})
