import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowPersistenceV2 } from './useWorkflowPersistenceV2'

const settingMocks = vi.hoisted(() => ({
  persistRef: null as { value: boolean } | null,
  values: {} as Record<string, unknown>
}))

vi.mock('@/platform/settings/settingStore', async () => {
  const { ref } = await import('vue')
  settingMocks.persistRef = ref(true)
  return {
    useSettingStore: vi.fn(() => ({
      get: vi.fn((key: string) => {
        if (key === 'Comfy.Workflow.Persist') {
          return settingMocks.persistRef!.value
        }
        return settingMocks.values[key]
      }),
      set: vi.fn((key: string, value: unknown) => {
        settingMocks.values[key] = value
      })
    }))
  }
})

const mockToastAdd = vi.fn()
vi.mock('primevue', () => ({
  useToast: () => ({ add: mockToastAdd })
}))
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
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
    useTemplateUrlLoader: () => ({ loadTemplateFromUrl: vi.fn() })
  })
)

const commandStoreMocks = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: commandStoreMocks.execute })
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
  useRouter: () => ({ replace: vi.fn() })
}))

const currentUserMocks = vi.hoisted(() => ({
  onUserLogout: vi.fn(),
  onUserResolved: vi.fn()
}))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserLogout: currentUserMocks.onUserLogout,
    onUserResolved: currentUserMocks.onUserResolved
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

const distributionMocks = vi.hoisted(() => ({ isCloud: false }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distributionMocks.isCloud
  }
}))

const teamWorkspaceStoreMocks = reactive<{
  initState: 'uninitialized' | 'ready' | 'error'
  activeWorkspaceId: string | null
}>({
  initState: 'uninitialized',
  activeWorkspaceId: null
})
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => teamWorkspaceStoreMocks
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
      if (event === 'graphChanged') state.graphChangedHandler = handler
    }),
    removeEventListener: vi.fn()
  }
  return { state, serializeMock, loadGraphDataMock, apiMock }
})

vi.mock('@/scripts/app', () => ({
  app: {
    graph: { serialize: () => mocks.serializeMock() },
    rootGraph: { serialize: () => mocks.serializeMock() },
    loadGraphData: (...args: unknown[]) => mocks.loadGraphDataMock(...args),
    canvas: {}
  }
}))
vi.mock('@/scripts/api', () => ({ api: mocks.apiMock }))

type WorkflowPersistence = ReturnType<typeof useWorkflowPersistenceV2>

describe('workflow persistence lifecycle reconciliation', () => {
  const mountedApps: Array<{
    app: ReturnType<typeof createApp>
    container: HTMLElement
  }> = []

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers()
    settingMocks.persistRef!.value = true
    settingMocks.values = {}
    mocks.state.graphChangedHandler = null
    mocks.state.currentGraph = { initial: true }
    mocks.serializeMock.mockImplementation(() => mocks.state.currentGraph)
    mocks.apiMock.clientId = 'test-client'
    mocks.apiMock.initialClientId = 'test-client'
    mocks.apiMock.addEventListener.mockImplementation(
      (event: string, handler: () => void) => {
        if (event === 'graphChanged') mocks.state.graphChangedHandler = handler
      }
    )
    mocks.apiMock.removeEventListener.mockImplementation(() => {})
    routeMocks.query = {}
    preservedQueryMocks.payloads = {}
    distributionMocks.isCloud = false
    teamWorkspaceStoreMocks.initState = 'uninitialized'
    teamWorkspaceStoreMocks.activeWorkspaceId = null
  })

  afterEach(() => {
    for (const { app, container } of mountedApps.splice(0)) {
      app.unmount()
      container.remove()
    }
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
        legacy: false,
        locale: 'en',
        messages: { en: {} },
        missingWarn: false,
        fallbackWarn: false
      })
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    app.mount(container)
    mountedApps.push({ app, container })
    if (!persistence) {
      throw new Error('Failed to mount workflow persistence composable')
    }
    return persistence
  }

  async function loadBlankIntoActiveWorkflow() {
    const workflowStore = useWorkflowStore()
    const blank = workflowStore.createTemporary('unsaved-workflow.json')
    await workflowStore.openWorkflow(blank)
  }

  it('keeps one save-failure notification across workflow transitions until recovery', async () => {
    await loadBlankIntoActiveWorkflow()

    const workflowStore = useWorkflowStore()
    const draftStore = useWorkflowDraftStoreV2()
    const saveDraftSpy = vi.spyOn(draftStore, 'saveDraft')
    saveDraftSpy.mockReturnValue(false)

    mountWorkflowPersistence()

    mocks.state.currentGraph = { nodes: [{ id: 1 }] }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    mocks.state.currentGraph = { nodes: [{ id: 2 }] }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()
    expect(mockToastAdd).toHaveBeenCalledTimes(1)

    const second = workflowStore.createTemporary('second-workflow.json')
    await workflowStore.openWorkflow(second)
    await nextTick()
    expect(mockToastAdd).toHaveBeenCalledTimes(1)

    saveDraftSpy.mockReturnValueOnce(true)
    mocks.state.currentGraph = { nodes: [{ id: 3 }] }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    saveDraftSpy.mockReturnValueOnce(false)
    mocks.state.currentGraph = { nodes: [{ id: 4 }] }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()
    expect(mockToastAdd).toHaveBeenCalledTimes(2)
  })

  it('persists a modified temporary startup workflow synchronously only once', async () => {
    loadBlankWorkflowMock.mockImplementation(async () => {
      await loadBlankIntoActiveWorkflow()
      const workflow = useWorkflowStore().activeWorkflow
      if (workflow) workflow.isModified = true
    })

    const draftStore = useWorkflowDraftStoreV2()
    const saveDraftSpy = vi.spyOn(draftStore, 'saveDraft')
    vi.spyOn(draftStore, 'getDraft').mockReturnValue(null)

    const { initializeWorkflow } = mountWorkflowPersistence()

    await initializeWorkflow()
    expect(saveDraftSpy).toHaveBeenCalledOnce()

    await vi.runAllTimersAsync()
    expect(saveDraftSpy).toHaveBeenCalledOnce()
  })

  it('uses a default temporary workflow for schema-invalid draft JSON', async () => {
    const workflowStore = useWorkflowStore()
    vi.spyOn(workflowStore, 'loadWorkflows').mockResolvedValue()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const draftStore = useWorkflowDraftStoreV2()
    const path = 'workflows/invalid-draft.json'
    const invalidDraftData = JSON.stringify({ title: 'not-a-workflow' })
    expect(
      draftStore.saveDraft(path, invalidDraftData, {
        name: 'invalid-draft.json',
        isTemporary: true
      })
    ).toBe(true)
    sessionStorage.setItem(
      'Comfy.Workflow.OpenPaths:test-client',
      JSON.stringify({
        workspaceId: 'personal',
        paths: [path],
        activeIndex: 0
      })
    )

    const { restoreWorkflowTabsState } = mountWorkflowPersistence()
    await restoreWorkflowTabsState()

    const restored = workflowStore.getWorkflowByPath(path)
    expect(restored).toBeDefined()
    if (!restored?.content) {
      throw new Error('Expected restored temporary workflow content')
    }
    const restoredData = JSON.parse(restored.content) as {
      version?: unknown
      title?: unknown
    }
    expect(typeof restoredData.version).toBe('number')
    expect(restoredData.title).toBeUndefined()
    expect(draftStore.getDraft(path)).toBeNull()
  })
})
