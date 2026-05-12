import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { PERSIST_DEBOUNCE_MS } from '../base/draftTypes'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowPersistenceV2 } from './useWorkflowPersistenceV2'

const settingMocks = vi.hoisted(() => ({
  persistRef: null as { value: boolean } | null,
  tutorialCompletedRef: null as { value: boolean } | null,
  set: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', async () => {
  const { ref } = await import('vue')
  settingMocks.persistRef = ref(true)
  settingMocks.tutorialCompletedRef = ref(true)
  return {
    useSettingStore: vi.fn(() => ({
      get: vi.fn((key: string) => {
        if (key === 'Comfy.Workflow.Persist')
          return settingMocks.persistRef!.value
        if (key === 'Comfy.TutorialCompleted')
          return settingMocks.tutorialCompletedRef!.value
        return undefined
      }),
      set: settingMocks.set
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

const commandMocks = vi.hoisted(() => ({
  execute: vi.fn()
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => commandMocks
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

vi.mock('../migration/migrateV1toV2', () => ({
  migrateV1toV2: vi.fn()
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
    listUserDataFullInfo: vi.fn(),
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

type WorkflowPersistenceV2 = ReturnType<typeof useWorkflowPersistenceV2>

let mountedApps: Array<{ unmount: () => void }> = []

function mountWorkflowPersistence() {
  const result: { persistence: WorkflowPersistenceV2 | null } = {
    persistence: null
  }

  const HostComponent = defineComponent({
    setup() {
      result.persistence = useWorkflowPersistenceV2()
      return () => null
    }
  })

  const host = document.createElement('div')
  const app = createApp(HostComponent)
  app.use(
    createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} },
      missingWarn: false,
      fallbackWarn: false
    })
  )
  app.mount(host)
  mountedApps.push(app)

  if (!result.persistence) {
    throw new Error('Workflow persistence did not initialize')
  }

  return result.persistence
}

describe('useWorkflowPersistenceV2', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
    setActivePinia(createTestingPinia({ stubActions: false }))
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    settingMocks.persistRef!.value = true
    settingMocks.tutorialCompletedRef!.value = true
    mocks.state.graphChangedHandler = null
    mocks.state.currentGraph = { initial: true }
    mocks.serializeMock.mockImplementation(() => mocks.state.currentGraph)
    mocks.loadGraphDataMock.mockReset()
    mocks.apiMock.clientId = 'test-client'
    mocks.apiMock.initialClientId = 'test-client'
    mocks.apiMock.listUserDataFullInfo.mockResolvedValue([])
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
    for (const app of mountedApps) {
      app.unmount()
    }
    mountedApps = []
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

  describe('persistCurrentWorkflow', () => {
    it('persists graph changes and updates the active path pointer', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()
      const workflow = await workflowStore
        .createTemporary('Autosave.json')
        .load()
      workflowStore.activeWorkflow = workflow
      mocks.state.currentGraph = { nodes: [{ id: 1 }] }

      mountWorkflowPersistence()
      mocks.state.graphChangedHandler?.()
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS)

      const draft = draftStore.getDraft(workflow.path)
      expect(draft?.data).toBe(JSON.stringify(mocks.state.currentGraph))

      const activePointer = JSON.parse(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:test-client')!
      )
      expect(activePointer.path).toBe(workflow.path)
    })

    it('shows a toast when saving the active workflow draft fails', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()
      const workflow = await workflowStore
        .createTemporary('SaveFailure.json')
        .load()
      workflowStore.activeWorkflow = workflow
      vi.spyOn(draftStore, 'saveDraft').mockReturnValue(false)

      mountWorkflowPersistence()
      mocks.state.graphChangedHandler?.()
      await vi.advanceTimersByTimeAsync(PERSIST_DEBOUNCE_MS)

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'g.error',
        detail: 'toastMessages.failedToSaveDraft'
      })
      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:test-client')
      ).toBeNull()
    })
  })

  describe('loadPreviousWorkflowFromStorage', () => {
    it('loads saved workflow when draft is missing for session path', async () => {
      const workflowStore = useWorkflowStore()
      const savedWorkflow = workflowStore.createTemporary('SavedWorkflow.json')

      // Set session path to the saved workflow but do NOT create a draft
      writeActivePath(savedWorkflow.path)

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      // Should call workflowService.openWorkflow with the saved workflow
      expect(openWorkflowMock).toHaveBeenCalledWith(savedWorkflow)
      // Should NOT fall through to loadGraphData (fallbackToLatestDraft)
      expect(mocks.loadGraphDataMock).not.toHaveBeenCalled()
      // Should not sync metadata when the workflow is already known locally.
      expect(mocks.apiMock.listUserDataFullInfo).not.toHaveBeenCalled()
    })

    it('syncs workflow metadata when saved session path is not known locally', async () => {
      mocks.apiMock.listUserDataFullInfo.mockResolvedValue([
        { path: 'SavedWorkflow.json', modified: 100, size: 1 }
      ])
      writeActivePath('workflows/SavedWorkflow.json')

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      const workflowStore = useWorkflowStore()
      expect(mocks.apiMock.listUserDataFullInfo).toHaveBeenCalledWith(
        'workflows'
      )
      expect(openWorkflowMock).toHaveBeenCalledWith(
        workflowStore.getWorkflowByPath('workflows/SavedWorkflow.json')
      )
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

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      // Should load draft via loadGraphData, not via workflowService.openWorkflow
      expect(mocks.loadGraphDataMock).toHaveBeenCalled()
      expect(openWorkflowMock).not.toHaveBeenCalled()
      expect(mocks.apiMock.listUserDataFullInfo).not.toHaveBeenCalled()
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

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      // Should load via fallbackToLatestDraft
      expect(mocks.loadGraphDataMock).toHaveBeenCalled()
      expect(openWorkflowMock).not.toHaveBeenCalled()
      expect(mocks.apiMock.listUserDataFullInfo).not.toHaveBeenCalled()
    })
  })

  describe('initializeWorkflow', () => {
    it('does not load a default workflow when stored tab state will be restored separately', async () => {
      writeTabState(['workflows/A.json'], 0)

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(mocks.loadGraphDataMock).not.toHaveBeenCalled()
      expect(loadBlankWorkflowMock).not.toHaveBeenCalled()
      expect(mocks.apiMock.listUserDataFullInfo).not.toHaveBeenCalled()
    })

    it('does not overwrite stored tab state before tab restore runs', async () => {
      const workflowStore = useWorkflowStore()
      writeTabState(['workflows/A.json'], 0)

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      const workflow = await workflowStore
        .createTemporary('Current.json')
        .load()
      workflowStore.attachWorkflow(workflow, 0)
      workflowStore.activeWorkflow = workflow
      await nextTick()

      expect(
        JSON.parse(
          sessionStorage.getItem('Comfy.Workflow.OpenPaths:test-client')!
        )
      ).toMatchObject({
        paths: ['workflows/A.json'],
        activeIndex: 0
      })
    })

    it('loads the onboarding blank workflow when persistence is disabled before tutorial completion', async () => {
      settingMocks.persistRef!.value = false
      settingMocks.tutorialCompletedRef!.value = false

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(settingMocks.set).toHaveBeenCalledWith(
        'Comfy.TutorialCompleted',
        true
      )
      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(commandMocks.execute).toHaveBeenCalledWith('Comfy.BrowseTemplates')
    })

    it('loads the default graph when persistence is disabled after tutorial completion', async () => {
      settingMocks.persistRef!.value = false

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(mocks.loadGraphDataMock).toHaveBeenCalled()
      expect(loadBlankWorkflowMock).not.toHaveBeenCalled()
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

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
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

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).toHaveBeenCalledWith(workflowA)
    })

    it('does not call openWorkflow when no restorable state', async () => {
      // No tab state written to sessionStorage
      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
      expect(mocks.apiMock.listUserDataFullInfo).not.toHaveBeenCalled()
    })

    it('does not restore when storedActiveIndex is out of range', async () => {
      writeTabState(['workflows/A.json'], 1)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
      expect(mocks.apiMock.listUserDataFullInfo).not.toHaveBeenCalled()
    })

    it('loads saved workflows before restoring stored tabs', async () => {
      mocks.apiMock.listUserDataFullInfo.mockResolvedValue([
        { path: 'A.json', modified: 100, size: 1 },
        { path: 'B.json', modified: 200, size: 1 }
      ])

      writeTabState(['workflows/A.json', 'workflows/B.json'], 1)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      const workflowStore = useWorkflowStore()
      expect(workflowStore.openWorkflows.map((w) => w?.path)).toEqual([
        'workflows/A.json',
        'workflows/B.json'
      ])
      expect(openWorkflowMock).toHaveBeenCalledWith(
        workflowStore.getWorkflowByPath('workflows/B.json')
      )
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

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      const restored = workflowStore.getWorkflowByPath(path)
      expect(restored).toBeTruthy()
      expect(restored?.isTemporary).toBe(true)
      expect(workflowStore.openWorkflows.map((w) => w?.path)).toContain(path)
    })

    it('falls back to a default temporary workflow when a stored draft cannot be parsed', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()
      const path = 'workflows/Broken.json'
      draftStore.saveDraft(path, 'not-json', {
        name: 'Broken.json',
        isTemporary: true
      })

      writeTabState([path], 0)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(draftStore.getDraft(path)).toBeNull()
      expect(
        workflowStore.workflows.some(
          (workflow) => workflow.fullFilename === 'Broken.json'
        )
      ).toBe(true)
    })

    it('skips activation when persistence is disabled', async () => {
      settingMocks.persistRef!.value = false

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
    })
  })
})
