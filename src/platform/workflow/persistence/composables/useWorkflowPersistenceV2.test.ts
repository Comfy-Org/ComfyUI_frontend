import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useOnboardingEntryStore } from '../onboardingEntryStore'
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

const openWorkflowMock = vi.fn()
const loadBlankWorkflowMock = vi.fn()
vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    openWorkflow: openWorkflowMock,
    loadBlankWorkflow: loadBlankWorkflowMock
  })
}))

const templateLoaderMocks = vi.hoisted(() => ({
  loadTemplateFromUrl: vi.fn(
    async () => ({ loaded: false }) as { loaded: boolean; templateId?: string }
  )
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateUrlLoader',
  () => ({
    useTemplateUrlLoader: () => ({
      loadTemplateFromUrl: templateLoaderMocks.loadTemplateFromUrl
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
  query: {} as Record<string, unknown>
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    get query() {
      return routeMocks.query
    }
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
  get isCloud() {
    return onboardingMocks.isCloud
  }
}))

const onboardingMocks = vi.hoisted(() => ({
  isCloud: false,
  onboardingTourEnabled: false,
  isNewUser: null as boolean | null,
  isSubscriptionEnabled: true,
  loadWorkflowTemplates: vi.fn(async () => {})
}))

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      loadWorkflowTemplates: onboardingMocks.loadWorkflowTemplates
    })
  })
)

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get onboardingTourEnabled() {
        return onboardingMocks.onboardingTourEnabled
      }
    }
  })
}))

vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({
    isNewUser: () => onboardingMocks.isNewUser
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isSubscriptionEnabled: () => onboardingMocks.isSubscriptionEnabled
  })
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
    commandStoreMocks.execute.mockReset()
    routeMocks.query = {}
    preservedQueryMocks.payloads = {}
    onboardingMocks.isCloud = false
    onboardingMocks.onboardingTourEnabled = false
    onboardingMocks.isNewUser = null
    onboardingMocks.isSubscriptionEnabled = true
    templateLoaderMocks.loadTemplateFromUrl.mockReset()
    templateLoaderMocks.loadTemplateFromUrl.mockResolvedValue({ loaded: false })
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

    it('shows Getting Started instead of the templates browser for a flagged new user', async () => {
      onboardingMocks.isCloud = true
      onboardingMocks.onboardingTourEnabled = true
      onboardingMocks.isNewUser = true
      const entryStore = useOnboardingEntryStore()

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(loadBlankWorkflowMock).toHaveBeenCalled()
      expect(entryStore.shouldShowGettingStarted).toBe(true)
      expect(commandStoreMocks.execute).not.toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('opens the templates browser off the Cloud build, matching the tour gate', async () => {
      onboardingMocks.isCloud = false
      onboardingMocks.onboardingTourEnabled = true
      onboardingMocks.isNewUser = true
      const entryStore = useOnboardingEntryStore()

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(entryStore.shouldShowGettingStarted).toBe(false)
      expect(commandStoreMocks.execute).toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('prefetches templates when Getting Started is shown so its cards are ready', async () => {
      onboardingMocks.isCloud = true
      onboardingMocks.onboardingTourEnabled = true
      onboardingMocks.isNewUser = true

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(onboardingMocks.loadWorkflowTemplates).toHaveBeenCalled()
    })

    it('opens the templates browser when the flag is on but the user is not new', async () => {
      onboardingMocks.onboardingTourEnabled = true
      onboardingMocks.isNewUser = false
      const entryStore = useOnboardingEntryStore()

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(entryStore.shouldShowGettingStarted).toBe(false)
      expect(commandStoreMocks.execute).toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('opens the templates browser when the flag is off', async () => {
      onboardingMocks.onboardingTourEnabled = false
      onboardingMocks.isNewUser = true
      const entryStore = useOnboardingEntryStore()

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(entryStore.shouldShowGettingStarted).toBe(false)
      expect(commandStoreMocks.execute).toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('opens the templates browser, not Getting Started, when subscriptions are disabled', async () => {
      // The tour refuses when subscriptions are off, so the takeover must not show
      // — otherwise it would dismiss into a bare canvas with no tour.
      onboardingMocks.onboardingTourEnabled = true
      onboardingMocks.isNewUser = true
      onboardingMocks.isSubscriptionEnabled = false
      const entryStore = useOnboardingEntryStore()

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(entryStore.shouldShowGettingStarted).toBe(false)
      expect(commandStoreMocks.execute).toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })

    it('does not show Getting Started for a flagged new user arriving via a template URL', async () => {
      onboardingMocks.onboardingTourEnabled = true
      onboardingMocks.isNewUser = true
      routeMocks.query = { template: 'default-template-id' }
      const entryStore = useOnboardingEntryStore()

      const { initializeWorkflow } = mountWorkflowPersistence()
      await initializeWorkflow()

      expect(entryStore.shouldShowGettingStarted).toBe(false)
      expect(commandStoreMocks.execute).not.toHaveBeenCalledWith(
        'Comfy.BrowseTemplates'
      )
    })
  })

  describe('loadTemplateFromUrlIfPresent', () => {
    it('surfaces the validated template id the loader reports', async () => {
      routeMocks.query = { template: 'image_z_image_turbo' }
      templateLoaderMocks.loadTemplateFromUrl.mockResolvedValue({
        loaded: true,
        templateId: 'image_z_image_turbo'
      })

      const { loadTemplateFromUrlIfPresent } = mountWorkflowPersistence()

      await expect(loadTemplateFromUrlIfPresent()).resolves.toEqual({
        loaded: true,
        templateId: 'image_z_image_turbo'
      })
    })

    it('reports not-loaded when the loader loads nothing', async () => {
      routeMocks.query = {}
      templateLoaderMocks.loadTemplateFromUrl.mockResolvedValue({
        loaded: false
      })

      const { loadTemplateFromUrlIfPresent } = mountWorkflowPersistence()

      await expect(loadTemplateFromUrlIfPresent()).resolves.toEqual({
        loaded: false
      })
    })

    it('hydrates preserved template intent before delegating to the loader', async () => {
      preservedQueryMocks.payloads.template = {
        template: 'image_z_image_turbo'
      }
      templateLoaderMocks.loadTemplateFromUrl.mockResolvedValue({
        loaded: true,
        templateId: 'image_z_image_turbo'
      })

      const { loadTemplateFromUrlIfPresent } = mountWorkflowPersistence()
      await loadTemplateFromUrlIfPresent()

      expect(templateLoaderMocks.loadTemplateFromUrl).toHaveBeenCalled()
    })
  })
})
