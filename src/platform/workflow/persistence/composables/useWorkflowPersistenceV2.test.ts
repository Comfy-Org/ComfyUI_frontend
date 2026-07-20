import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { PERSIST_DEBOUNCE_MS } from '../base/draftTypes'
import { migrateV1toV2 } from '../migration/migrateV1toV2'
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

const sharedWorkflowLoaderMocks = vi.hoisted(() => ({
  load: vi.fn().mockResolvedValue('not-present')
}))

vi.mock(
  '@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader',
  () => ({
    useSharedWorkflowUrlLoader: () => ({
      loadSharedWorkflowFromUrl: sharedWorkflowLoaderMocks.load
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

const templateLoaderMocks = vi.hoisted(() => ({
  load: vi.fn()
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateUrlLoader',
  () => ({
    useTemplateUrlLoader: () => ({
      loadTemplateFromUrl: templateLoaderMocks.load
    })
  })
)

const commandStoreMocks = vi.hoisted(() => ({
  execute: vi.fn()
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: commandStoreMocks.execute
  })
}))

const routeMocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  replace: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    get query() {
      return routeMocks.query
    }
  }),
  useRouter: () => ({
    replace: routeMocks.replace
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserLogout: vi.fn()
  })
}))

const preservedQueryMocks = vi.hoisted(() => ({
  payloads: {} as Record<string, Record<string, string> | undefined>
}))

vi.mock('@/platform/navigation/preservedQueryManager', () => ({
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn(
    (namespace: string, query: Record<string, unknown> = {}) => {
      const payload = preservedQueryMocks.payloads[namespace]
      if (!payload) return undefined
      const next: Record<string, unknown> = { ...query }
      let changed = false
      for (const [key, value] of Object.entries(payload)) {
        if (typeof next[key] === 'string') continue
        next[key] = value
        changed = true
      }
      return changed ? next : undefined
    }
  )
}))

vi.mock('@/platform/navigation/preservedQueryNamespaces', () => ({
  PRESERVED_QUERY_NAMESPACES: { TEMPLATE: 'template', SHARE: 'share' }
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
    clientId: 'test-client' as string | undefined,
    initialClientId: 'test-client' as string | null,
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

type WorkflowPersistence = ReturnType<typeof useWorkflowPersistenceV2>

describe('useWorkflowPersistenceV2', () => {
  const mountedApps: Array<{
    app: ReturnType<typeof createApp>
    container: HTMLElement
  }> = []

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
    sharedWorkflowLoaderMocks.load.mockReset()
    sharedWorkflowLoaderMocks.load.mockResolvedValue('not-present')
    templateLoaderMocks.load.mockReset()
    commandStoreMocks.execute.mockReset()
    routeMocks.query = {}
    routeMocks.replace.mockReset()
    preservedQueryMocks.payloads = {}
  })

  afterEach(() => {
    for (const { app, container } of mountedApps.splice(0)) {
      app.unmount()
      container.remove()
    }
    vi.useRealTimers()
  })

  function mountWorkflowPersistence(): WorkflowPersistence {
    let persistence: WorkflowPersistence | undefined
    const HostComponent = defineComponent({
      setup() {
        persistence = useWorkflowPersistenceV2()
        return () => null
      }
    })
    const app = createApp(HostComponent)
    app.use(
      createI18n({
        // Empty messages make t(key) return the key, matching the old i18n mock.
        legacy: false,
        locale: 'en',
        messages: { en: {} },
        missingWarn: false,
        fallbackWarn: false
      })
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    try {
      app.mount(container)
      mountedApps.push({ app, container })
    } catch (error) {
      container.remove()
      throw error
    }

    if (!persistence) {
      throw new Error('Failed to mount workflow persistence composable')
    }

    return persistence
  }

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

  function createDeferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    const promise = new Promise<T>((res) => {
      resolve = res
    })
    return { promise, resolve }
  }

  describe('migration', () => {
    it('falls back to initialClientId when clientId is unavailable', () => {
      mocks.apiMock.clientId = undefined
      mocks.apiMock.initialClientId = 'initial-client'

      mountWorkflowPersistence()

      expect(migrateV1toV2).toHaveBeenCalledWith(undefined, 'initial-client')
    })

    it('passes undefined when no API client id is available', () => {
      mocks.apiMock.clientId = undefined
      mocks.apiMock.initialClientId = null

      mountWorkflowPersistence()

      expect(migrateV1toV2).toHaveBeenCalledWith(undefined, undefined)
    })
  })

  describe('persistence toggle', () => {
    it('resets the V2 draft store only after workflow persistence is disabled', async () => {
      const draftStore = useWorkflowDraftStoreV2()
      const resetSpy = vi.spyOn(draftStore, 'reset')

      mountWorkflowPersistence()
      expect(resetSpy).not.toHaveBeenCalled()

      settingMocks.persistRef!.value = false
      await nextTick()

      expect(resetSpy).toHaveBeenCalledOnce()
    })
  })

  describe('graph change persistence', () => {
    it('saves the active workflow draft after graphChanged debounce', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()
      const workflow = workflowStore.createTemporary('ActiveWorkflow.json')
      await workflowStore.openWorkflow(workflow)
      mocks.state.currentGraph = { nodes: [{ id: 1 }] }

      mountWorkflowPersistence()
      mocks.state.graphChangedHandler?.()
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)

      const draft = draftStore.getDraft(workflow.path)
      expect(draft?.data).toBe(JSON.stringify(mocks.state.currentGraph))
      expect(draft?.name).toBe(workflow.key)
    })

    it('shows a toast when saving the active workflow draft fails', async () => {
      const workflowStore = useWorkflowStore()
      const draftStore = useWorkflowDraftStoreV2()
      const workflow = workflowStore.createTemporary('FailingWorkflow.json')
      await workflowStore.openWorkflow(workflow)
      vi.spyOn(draftStore, 'saveDraft').mockReturnValue(false)

      mountWorkflowPersistence()
      mocks.state.graphChangedHandler?.()
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'toastMessages.failedToSaveDraft'
        })
      )
    })
  })

  describe('url workflow loaders', () => {
    it('loads a template from the current route query', async () => {
      routeMocks.query = { template: 'template-id' }
      const { loadTemplateFromUrlIfPresent } = mountWorkflowPersistence()

      await loadTemplateFromUrlIfPresent()

      expect(routeMocks.replace).not.toHaveBeenCalled()
      expect(templateLoaderMocks.load).toHaveBeenCalledOnce()
    })

    it('hydrates preserved template intent back into the route before loading', async () => {
      preservedQueryMocks.payloads.template = { template: 'template-id' }
      const { loadTemplateFromUrlIfPresent } = mountWorkflowPersistence()

      await loadTemplateFromUrlIfPresent()

      expect(routeMocks.replace).toHaveBeenCalledWith({
        query: { template: 'template-id' }
      })
      expect(templateLoaderMocks.load).toHaveBeenCalledOnce()
    })

    it('does not load a template when no template intent is present', async () => {
      const { loadTemplateFromUrlIfPresent } = mountWorkflowPersistence()

      await loadTemplateFromUrlIfPresent()

      expect(routeMocks.replace).not.toHaveBeenCalled()
      expect(templateLoaderMocks.load).not.toHaveBeenCalled()
    })

    it('returns the shared workflow loader result', async () => {
      sharedWorkflowLoaderMocks.load.mockResolvedValueOnce('loaded')
      const { loadSharedWorkflowFromUrlIfPresent } = mountWorkflowPersistence()

      await expect(loadSharedWorkflowFromUrlIfPresent()).resolves.toBe('loaded')
    })
  })

  describe('loadPreviousWorkflowFromStorage', () => {
    it('does not restore the active workflow early when open tab state exists', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
      const workflowA = workflowStore.createTemporary('WorkflowA.json')
      const workflowB = workflowStore.createTemporary('WorkflowB.json')

      writeTabState([workflowA.path, workflowB.path], 0)
      writeActivePath(workflowB.path)

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(openWorkflowMock).not.toHaveBeenCalled()
      expect(mocks.loadGraphDataMock).not.toHaveBeenCalled()
    })

    it('waits for workflow metadata before restoring the session workflow', async () => {
      const workflowStore = useWorkflowStore()
      const loadWorkflowsSpy = vi.spyOn(workflowStore, 'loadWorkflows')
      const savedWorkflow = workflowStore.createTemporary('SavedWorkflow.json')
      writeActivePath(savedWorkflow.path)

      const gate = createDeferred<void>()
      loadWorkflowsSpy.mockReturnValue(gate.promise)

      const { initializeWorkflow } = mountWorkflowPersistence()
      const pending = initializeWorkflow()

      await Promise.resolve()

      expect(loadWorkflowsSpy).toHaveBeenCalledOnce()
      expect(openWorkflowMock).not.toHaveBeenCalled()
      expect(mocks.loadGraphDataMock).not.toHaveBeenCalled()

      gate.resolve()
      await pending

      expect(openWorkflowMock).toHaveBeenCalledWith(savedWorkflow)
    })

    it('loads saved workflow when draft is missing for session path', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
      const savedWorkflow = workflowStore.createTemporary('SavedWorkflow.json')

      // Set session path to the saved workflow but do NOT create a draft
      writeActivePath(savedWorkflow.path)

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      // Should call workflowService.openWorkflow with the saved workflow
      expect(openWorkflowMock).toHaveBeenCalledWith(savedWorkflow)
      // Should NOT fall through to loadGraphData (fallbackToLatestDraft)
      expect(mocks.loadGraphDataMock).not.toHaveBeenCalled()
    })

    it('prefers draft over saved workflow when draft exists', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
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
    })

    it('falls back to latest draft only when no session path exists', async () => {
      vi.spyOn(useWorkflowStore(), 'loadWorkflows').mockResolvedValue()
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
    })
  })

  describe('restoreWorkflowTabsState', () => {
    it('waits for workflow metadata before restoring tab pointers', async () => {
      const workflowStore = useWorkflowStore()
      const loadWorkflowsSpy = vi.spyOn(workflowStore, 'loadWorkflows')
      const workflowA = workflowStore.createTemporary('WorkflowA.json')
      const workflowB = workflowStore.createTemporary('WorkflowB.json')
      writeTabState([workflowA.path, workflowB.path], 1)

      const gate = createDeferred<void>()
      loadWorkflowsSpy.mockReturnValue(gate.promise)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      const pending = restoreWorkflowTabsState()

      await Promise.resolve()

      expect(loadWorkflowsSpy).toHaveBeenCalledOnce()
      expect(openWorkflowMock).not.toHaveBeenCalled()

      gate.resolve()
      await pending

      expect(openWorkflowMock).toHaveBeenCalledWith(workflowB)
    })

    it('falls back to the default workflow when metadata loading fails', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(workflowStore, 'loadWorkflows').mockRejectedValue(
        new Error('metadata failed')
      )
      writeTabState(['workflows/WorkflowA.json'], 0)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(openWorkflowMock).not.toHaveBeenCalled()
    })

    it('activates the correct workflow at storedActiveIndex', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
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
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
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
      vi.spyOn(useWorkflowStore(), 'loadWorkflows').mockResolvedValue()
      // No tab state written to sessionStorage
      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
    })

    it('does not restore tab state with an out-of-range activeIndex', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
      const openInBackgroundSpy = vi.spyOn(
        workflowStore,
        'openWorkflowsInBackground'
      )
      const workflowA = workflowStore.createTemporary('WorkflowA.json')

      writeTabState([workflowA.path], 1)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openInBackgroundSpy).not.toHaveBeenCalled()
      expect(openWorkflowMock).not.toHaveBeenCalled()
    })

    it('restores temporary workflows and adds them to tabs', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
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

    it('recovers malformed temporary drafts with a default temporary workflow', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const draftStore = useWorkflowDraftStoreV2()
      const path = 'workflows/Broken.json'
      draftStore.saveDraft(path, '{bad json', {
        name: 'Broken.json',
        isTemporary: true
      })
      writeTabState([path], 0)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to parse workflow draft, creating with default',
        expect.any(Error)
      )
      expect(draftStore.getDraft(path)).toBeNull()
      expect(workflowStore.getWorkflowByPath(path)?.isTemporary).toBe(true)

      warnSpy.mockRestore()
    })

    it('does not recreate a missing saved workflow from a non-temporary draft', async () => {
      const workflowStore = useWorkflowStore()
      vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
      const draftStore = useWorkflowDraftStoreV2()
      const path = 'workflows/Saved.json'
      draftStore.saveDraft(path, JSON.stringify({ title: 'saved' }), {
        name: 'Saved.json',
        isTemporary: false
      })
      writeTabState([path], 0)

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(workflowStore.getWorkflowByPath(path)).toBeNull()
      expect(openWorkflowMock).not.toHaveBeenCalled()
    })

    it('skips activation when persistence is disabled', async () => {
      settingMocks.persistRef!.value = false
      vi.spyOn(useWorkflowStore(), 'loadWorkflows').mockResolvedValue()

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
    })
  })

  describe('loadDefaultWorkflow', () => {
    it('opens templates browser for first-time users', async () => {
      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(commandStoreMocks.execute).toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('does not open templates browser when share param is in URL', async () => {
      routeMocks.query = { share: 'test-share-id' }

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(commandStoreMocks.execute).not.toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('does not open templates browser when share intent is preserved across /user-select redirect', async () => {
      // No-local-user flow: ?share=... was captured into sessionStorage and the
      // URL query was dropped during the /user-select redirect before
      // initializeWorkflow() runs.
      preservedQueryMocks.payloads.share = { share: 'test-share-id' }

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(commandStoreMocks.execute).not.toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('does not open templates browser when template param is in URL', async () => {
      routeMocks.query = { template: 'default-template-id' }

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(commandStoreMocks.execute).not.toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('does not open templates browser when template intent is preserved across /user-select redirect', async () => {
      preservedQueryMocks.payloads.template = {
        template: 'default-template-id'
      }

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(commandStoreMocks.execute).not.toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })
  })
})
