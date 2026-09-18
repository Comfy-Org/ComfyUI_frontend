import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { defaultGraphJSON } from '@/scripts/defaultGraph'

vi.mock('@/scripts/api', () => ({
  api: {
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    listUserDataFullInfo: vi.fn(),
    apiURL: vi.fn(),
    addEventListener: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {}
  }
}))

vi.mock('@/utils/typeGuardUtil', () => ({
  isSubgraph: vi.fn(() => false)
}))

describe('workflow store draft reconciliation', () => {
  let store: ReturnType<typeof useWorkflowStore>

  const enableWorkflowPersistence = () => {
    useSettingStore().settingsById['Comfy.Workflow.Persist'] = {
      id: 'Comfy.Workflow.Persist',
      name: 'Persist workflow state',
      type: 'boolean',
      defaultValue: true
    }
  }

  const syncRemoteWorkflowsWithMeta = async (
    files: Array<{ path: string; modified: number; size: number }>
  ) => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(files)
    await store.syncWorkflows()
  }

  const saveV2Draft = (
    path: string,
    options: {
      data: string
      name: string
      isTemporary?: boolean
      isModified?: boolean
    }
  ) => {
    const draftStore = useWorkflowDraftStoreV2()
    draftStore.saveDraft(path, options.data, {
      name: options.name,
      isTemporary: options.isTemporary ?? false,
      ...(options.isModified === undefined
        ? {}
        : { isModified: options.isModified })
    })
    return draftStore
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    store = useWorkflowStore()
    enableWorkflowPersistence()

    vi.mocked(api.getUserData).mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ favorites: [] })
    } as Response)
    vi.mocked(api.storeUserData).mockResolvedValue({
      status: 200
    } as Response)
  })

  it('restores a clean persisted draft from the stored dirty-state metadata', async () => {
    await syncRemoteWorkflowsWithMeta([
      { path: 'a.json', modified: 100, size: 1 }
    ])

    const workflow = store.getWorkflowByPath('workflows/a.json')!
    const draftGraph = JSON.parse(defaultGraphJSON) as ComfyWorkflowJSON
    draftGraph.extra = {
      ...(draftGraph.extra ?? {}),
      ds: { scale: 1.25, offset: [40, 80] }
    }

    saveV2Draft(workflow.path, {
      data: JSON.stringify(draftGraph),
      name: 'a.json',
      isModified: false
    })

    vi.mocked(api.getUserData).mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(defaultGraphJSON)
    } as Response)

    await workflow.load()

    expect(workflow.activeState?.extra?.ds).toEqual({
      scale: 1.25,
      offset: [40, 80]
    })
    expect(workflow.isModified).toBe(false)
  })

  it('falls back to the saved viewport when a draft viewport is missing', async () => {
    await syncRemoteWorkflowsWithMeta([
      { path: 'viewport-fallback.json', modified: 100, size: 1 }
    ])

    const workflow = store.getWorkflowByPath(
      'workflows/viewport-fallback.json'
    )!
    const savedGraph = JSON.parse(defaultGraphJSON) as ComfyWorkflowJSON
    savedGraph.extra = {
      ...(savedGraph.extra ?? {}),
      ds: { scale: 0.85, offset: [12, -34] }
    }

    const draftGraph = JSON.parse(defaultGraphJSON) as ComfyWorkflowJSON
    draftGraph.extra = {
      ...(draftGraph.extra ?? {})
    }
    delete draftGraph.extra.ds

    saveV2Draft(workflow.path, {
      data: JSON.stringify(draftGraph),
      name: 'viewport-fallback.json',
      isModified: false
    })

    vi.mocked(api.getUserData).mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify(savedGraph))
    } as Response)

    await workflow.load()

    expect(workflow.activeState?.extra?.ds).toEqual({
      scale: 0.85,
      offset: [12, -34]
    })
    expect(workflow.isModified).toBe(false)
  })

  it('keeps a restored temporary draft despite a newer synthetic timestamp', async () => {
    const path = 'workflows/restored-temporary.json'
    const baseGraph = JSON.parse(defaultGraphJSON) as ComfyWorkflowJSON
    const draftGraph: ComfyWorkflowJSON = {
      ...baseGraph,
      extra: {
        ...(baseGraph.extra ?? {}),
        draftMarker: 'restored-temporary'
      }
    }
    const draftStore = saveV2Draft(path, {
      data: JSON.stringify(draftGraph),
      name: 'restored-temporary.json',
      isTemporary: true
    })

    const workflow = store.createTemporary('restored-temporary.json')
    workflow.lastModified = Date.now() + 60_000

    await workflow.load()

    expect(workflow.activeState?.extra?.draftMarker).toBe('restored-temporary')
    expect(workflow.isModified).toBe(true)
    expect(draftStore.getDraft(path)).not.toBeNull()
  })
})
