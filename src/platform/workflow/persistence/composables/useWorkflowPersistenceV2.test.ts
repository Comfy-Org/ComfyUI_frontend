import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as I18n from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowPersistenceV2 } from './useWorkflowPersistenceV2'

const settingMocks = vi.hoisted(() => ({
  persistRef: null as { value: boolean } | null
}))

vi.mock('@/platform/settings/settingStore', async () => {
  const { ref } = await import('vue')
  settingMocks.persistRef = ref(true)
  return {
    useSettingStore: vi.fn(() => ({
      get: vi.fn((key: string) => {
        if (key === 'Comfy.Workflow.Persist')
          return settingMocks.persistRef!.value
        return undefined
      }),
      set: vi.fn()
    }))
  }
})

const mockToastAdd = vi.fn()
vi.mock('primevue', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock(
  '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader',
  () => ({
    useSharedWorkflowUrlLoader: () => ({
      loadSharedWorkflowFromUrl: vi.fn().mockResolvedValue('not-present')
    })
  })
)

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof I18n>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const openWorkflowMock = vi.fn()
const loadBlankWorkflowMock = vi.fn()
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    openWorkflow: openWorkflowMock,
    loadBlankWorkflow: loadBlankWorkflowMock
  })
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateUrlLoader',
  () => ({
    useTemplateUrlLoader: () => ({
      loadTemplateFromUrl: vi.fn()
    })
  })
)

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {}
  }),
  useRouter: () => ({
    replace: vi.fn()
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserLogout: vi.fn()
  })
}))

vi.mock('@/platform/navigation/preservedQueryManager', () => ({
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn(() => null)
}))

vi.mock('@/platform/navigation/preservedQueryNamespaces', () => ({
  PRESERVED_QUERY_NAMESPACES: { TEMPLATE: 'template' }
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

type GraphChangedHandler = (() => void) | null

const mocks = vi.hoisted(() => {
  const state = {
    graphChangedHandler: null as GraphChangedHandler,
    currentGraph: {} as Record<string, unknown>
  }
  const serializeMock = vi.fn(() => state.currentGraph)
  const loadGraphDataMock = vi.fn()
  const apiMock = {
    clientId: 'test-client',
    initialClientId: 'test-client',
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === 'graphChanged') {
        state.graphChangedHandler = handler
      }
    }),
    removeEventListener: vi.fn()
  }
  return { state, serializeMock, loadGraphDataMock, apiMock }
})

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {
      serialize: () => mocks.serializeMock()
    },
    rootGraph: {
      serialize: () => mocks.serializeMock()
    },
    loadGraphData: (...args: unknown[]) => mocks.loadGraphDataMock(...args),
    canvas: {}
  }
}))

vi.mock('@/scripts/api', () => ({
  api: mocks.apiMock
}))

describe('useWorkflowPersistenceV2', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    settingMocks.persistRef!.value = true
    mocks.state.graphChangedHandler = null
    mocks.state.currentGraph = { initial: true }
    mocks.serializeMock.mockImplementation(() => mocks.state.currentGraph)
    mocks.loadGraphDataMock.mockReset()
    mocks.apiMock.clientId = 'test-client'
    mocks.apiMock.initialClientId = 'test-client'
    mocks.apiMock.addEventListener.mockImplementation(
      (event: string, handler: () => void) => {
        if (event === 'graphChanged') {
          mocks.state.graphChangedHandler = handler
        }
      }
    )
    mocks.apiMock.removeEventListener.mockImplementation(() => {})
    openWorkflowMock.mockReset()
    loadBlankWorkflowMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function writeTabState(paths: string[], activeIndex: number) {
    const pointer = {
      workspaceId: 'personal',
      paths,
      activeIndex
    }
    sessionStorage.setItem(
      `Comfy.Workflow.OpenPaths:test-client`,
      JSON.stringify(pointer)
    )
  }

  function writeActivePath(path: string) {
    const pointer = {
      workspaceId: 'personal',
      path
    }
    sessionStorage.setItem(
      `Comfy.Workflow.ActivePath:test-client`,
      JSON.stringify(pointer)
    )
  }

  describe('loadPreviousWorkflowFromStorage', () => {
    it('loads saved workflow when draft is missing for session path', async () => {
      const workflowStore = useWorkflowStore()
      const savedWorkflow = workflowStore.createTemporary('SavedWorkflow.json')

      // Set session path to the saved workflow but do NOT create a draft
      writeActivePath(savedWorkflow.path)

      const { initializeWorkflow } = useWorkflowPersistenceV2()
      await initializeWorkflow()

      // Should call workflowService.openWorkflow with the saved workflow
      expect(openWorkflowMock).toHaveBeenCalledWith(savedWorkflow)
      // Should NOT fall through to loadGraphData (fallbackToLatestDraft)
      expect(mocks.loadGraphDataMock).not.toHaveBeenCalled()
    })

    it('prefers draft over saved workflow when draft exists', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()

      const workflow = workflowStore.createTemporary('DraftWorkflow.json')
      const draftData = JSON.stringify({ nodes: [], title: 'draft' })
      draftStore.saveDraft(workflow.path, draftData, {
        name: 'DraftWorkflow.json',
        isTemporary: true
      })
      writeActivePath(workflow.path)

      mocks.loadGraphDataMock.mockResolvedValue(undefined)

      const { initializeWorkflow } = useWorkflowPersistenceV2()
      await initializeWorkflow()

      // Should load draft via loadGraphData, not via workflowService.openWorkflow
      expect(mocks.loadGraphDataMock).toHaveBeenCalled()
      expect(openWorkflowMock).not.toHaveBeenCalled()
    })

    it('falls back to latest draft only when no session path exists', async () => {
      const draftStore = useWorkflowDraftStoreV2()

      // No session path set, but a draft exists
      const draftData = JSON.stringify({ nodes: [], title: 'latest' })
      draftStore.saveDraft('workflows/Other.json', draftData, {
        name: 'Other.json',
        isTemporary: true
      })

      mocks.loadGraphDataMock.mockResolvedValue(undefined)

      const { initializeWorkflow } = useWorkflowPersistenceV2()
      await initializeWorkflow()

      // Should load via fallbackToLatestDraft
      expect(mocks.loadGraphDataMock).toHaveBeenCalled()
      expect(openWorkflowMock).not.toHaveBeenCalled()
    })
  })

  describe('restoreWorkflowTabsState', () => {
    it('activates the correct workflow at storedActiveIndex', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()

      // Create two temporary workflows with drafts
      const workflowA = workflowStore.createTemporary('WorkflowA.json')
      const workflowB = workflowStore.createTemporary('WorkflowB.json')

      draftStore.saveDraft(workflowA.path, JSON.stringify({ title: 'A' }), {
        name: 'WorkflowA.json',
        isTemporary: true
      })
      draftStore.saveDraft(workflowB.path, JSON.stringify({ title: 'B' }), {
        name: 'WorkflowB.json',
        isTemporary: true
      })

      // storedActiveIndex = 1 → WorkflowB should be activated
      writeTabState([workflowA.path, workflowB.path], 1)

      const { restoreWorkflowTabsState } = useWorkflowPersistenceV2()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).toHaveBeenCalledWith(workflowB)
    })

    it('activates first tab when storedActiveIndex is 0', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()

      const workflowA = workflowStore.createTemporary('WorkflowA.json')
      const workflowB = workflowStore.createTemporary('WorkflowB.json')

      draftStore.saveDraft(workflowA.path, JSON.stringify({ title: 'A' }), {
        name: 'WorkflowA.json',
        isTemporary: true
      })
      draftStore.saveDraft(workflowB.path, JSON.stringify({ title: 'B' }), {
        name: 'WorkflowB.json',
        isTemporary: true
      })

      writeTabState([workflowA.path, workflowB.path], 0)

      const { restoreWorkflowTabsState } = useWorkflowPersistenceV2()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).toHaveBeenCalledWith(workflowA)
    })

    it('does not call openWorkflow when no restorable state', async () => {
      // No tab state written to sessionStorage
      const { restoreWorkflowTabsState } = useWorkflowPersistenceV2()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
    })

    it('restores temporary workflows and adds them to tabs', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()

      // Save a draft for a workflow that doesn't exist in the store yet
      const path = 'workflows/Unsaved.json'
      draftStore.saveDraft(path, JSON.stringify({ title: 'Unsaved' }), {
        name: 'Unsaved.json',
        isTemporary: true
      })

      writeTabState([path], 0)

      const { restoreWorkflowTabsState } = useWorkflowPersistenceV2()
      await restoreWorkflowTabsState()

      const restored = workflowStore.getWorkflowByPath(path)
      expect(restored).toBeTruthy()
      expect(restored?.isTemporary).toBe(true)
      expect(workflowStore.openWorkflows.map((w) => w?.path)).toContain(path)
    })

    it('skips activation when persistence is disabled', async () => {
      settingMocks.persistRef!.value = false

      const { restoreWorkflowTabsState } = useWorkflowPersistenceV2()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
    })
  })
})
