import { useCommandStore } from '@/stores/commandStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { StorageKeys } from '../base/storageKeys'
import { unsafeStorageScope } from '@/platform/workflow/persistence/testUtils/storageScope'
import * as storageIO from '../base/storageIO'
import { useWorkflowDraftStoreV2 } from '../stores/workflowDraftStoreV2'
import { useWorkflowPersistenceV2 } from './useWorkflowPersistenceV2'
import { useStorageScopeLifecycle } from './useStorageScopeLifecycle'

const scope = unsafeStorageScope

const mockToastAdd = vi.fn()
vi.mock<unknown>(
  import('primevue'), // oxlint-disable-line comfy/no-primevue-imports
  () => ({
    useToast: () => ({
      add: mockToastAdd
    })
  })
)

vi.mock<unknown>(
  import('primevue/usetoast'), // oxlint-disable-line comfy/no-primevue-imports

  () => ({
    useToast: () => ({
      add: mockToastAdd
    })
  })
)

vi.mock(
  import('@/platform/workflow/sharing/composables/useSharedWorkflowUrlLoader'),
  () => ({
    useSharedWorkflowUrlLoader: () => ({
      loadSharedWorkflowFromUrl: vi.fn().mockResolvedValue('not-present')
    })
  })
)

const openWorkflowMock = vi.fn()
const loadBlankWorkflowMock = vi.fn()
vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: () => ({
      openWorkflow: openWorkflowMock,
      loadBlankWorkflow: loadBlankWorkflowMock
    })
  })
)

vi.mock(
  import('@/platform/workflow/templates/composables/useTemplateUrlLoader'),
  () => ({
    useTemplateUrlLoader: () => ({
      loadTemplateFromUrl: vi.fn()
    })
  })
)

const routeMocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>
}))

vi.mock<unknown>(import('vue-router'), () => ({
  useRoute: () => ({
    get query() {
      return routeMocks.query
    }
  }),
  useRouter: () => ({
    replace: vi.fn()
  })
}))

vi.mock(import('@/composables/auth/useCurrentUser'))

const preservedQueryMocks = vi.hoisted(() => ({
  payloads: {} as Record<string, Record<string, string> | undefined>
}))

vi.mock<unknown>(import('@/platform/navigation/preservedQueryManager'), () => ({
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

vi.mock<unknown>(
  import('@/platform/navigation/preservedQueryNamespaces'),
  () => ({
    PRESERVED_QUERY_NAMESPACES: { TEMPLATE: 'template', SHARE: 'share' }
  })
)

const distributionMocks = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distributionMocks.isCloud
  }
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

vi.mock<unknown>(import('@/scripts/app'), () => ({
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

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: mocks.apiMock
}))

type WorkflowPersistence = ReturnType<typeof useWorkflowPersistenceV2>

beforeEach(() => {
  vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
})

describe('useWorkflowPersistenceV2', () => {
  const resolvedUser = ref<{ id: string } | null>(null)
  const mountedApps: Array<{
    app: ReturnType<typeof createApp>
    container: HTMLElement
  }> = []

  beforeEach(() => {
    useSettingStore().settingValues['Comfy.Workflow.Persist'] = true
    mocks.state.graphChangedHandler = null
    mocks.state.currentGraph = { initial: true }
    mocks.serializeMock.mockImplementation(() => mocks.state.currentGraph)
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
    routeMocks.query = {}
    preservedQueryMocks.payloads = {}
    distributionMocks.isCloud = false
    resolvedUser.value = null
    storageIO.setStorageIdentity(null)
    storageIO.setStorageWorkspaceId(null)
    storageIO.resetStorageAvailable()
    useCurrentUser().resolvedUserInfo = computed(() => resolvedUser.value)
    Object.assign(useTeamWorkspaceStore(), { initState: 'uninitialized' })
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
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
        useStorageScopeLifecycle()
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

  function resolveUser(id: string): void {
    resolvedUser.value = { id }
  }

  function logoutUser(): void {
    resolvedUser.value = null
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

  async function loadBlankIntoActiveWorkflow() {
    const workflowStore = useWorkflowStore()
    const blank = workflowStore.createTemporary('unsaved-workflow.json')
    await workflowStore.openWorkflow(blank)
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

      useSettingStore().settingValues['Comfy.Workflow.Persist'] = false
      await nextTick()

      expect(resetSpy).toHaveBeenCalledOnce()
    })
  })

  describe('loadPreviousWorkflowFromStorage', () => {
    it('waits for Cloud identity and workspace scope before deciding storage is empty', async () => {
      distributionMocks.isCloud = true
      const loadWorkflowsSpy = vi
        .spyOn(useWorkflowStore(), 'loadWorkflows')
        .mockResolvedValue()
      const { initializeWorkflow } = mountWorkflowPersistence()

      const pending = initializeWorkflow()
      await Promise.resolve()

      expect(loadWorkflowsSpy).not.toHaveBeenCalled()
      expect(loadBlankWorkflowMock).not.toHaveBeenCalled()

      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify({ id: 'workspace-a', type: 'team' })
      )
      resolveUser('user-a')
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-a',
        initState: 'ready'
      })
      await nextTick()

      await expect(pending).resolves.toBe('fresh')
      expect(loadWorkflowsSpy).toHaveBeenCalledOnce()
      expect(loadBlankWorkflowMock).toHaveBeenCalledOnce()
    })

    it('preserves work created while startup waits for Cloud scope', async () => {
      distributionMocks.isCloud = true
      const workflowStore = useWorkflowStore()
      const workflow = await workflowStore
        .createTemporary('BeforeIdentity.json')
        .load()
      workflowStore.activeWorkflow = workflow
      const loadWorkflowsSpy = vi
        .spyOn(workflowStore, 'loadWorkflows')
        .mockResolvedValue()
      const { initializeWorkflow } = mountWorkflowPersistence()

      const pending = initializeWorkflow()
      await Promise.resolve()
      mocks.state.currentGraph = { marker: 'before-identity' }
      mocks.state.graphChangedHandler?.()

      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify({ id: 'workspace-a', type: 'team' })
      )
      resolveUser('user-a')
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-a',
        initState: 'ready'
      })
      await nextTick()
      await vi.runAllTimersAsync()

      await expect(pending).resolves.toBe('fresh')
      expect(loadWorkflowsSpy).not.toHaveBeenCalled()
      expect(loadBlankWorkflowMock).not.toHaveBeenCalled()
      const payload = localStorage.getItem(
        StorageKeys.draftPayload(workflow.path, scope('user-a:workspace-a'))
      )
      expect(payload).not.toBeNull()
      if (payload === null) throw new Error('Expected deferred draft payload')
      expect(JSON.parse(JSON.parse(payload).data)).toEqual({
        marker: 'before-identity'
      })
    })

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

      const gate = createDeferred()
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

      const gate = createDeferred()
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
      expect(workflowStore.openWorkflows.map((w) => w.path)).toContain(path)
    })

    it('skips activation when persistence is disabled', async () => {
      useSettingStore().settingValues['Comfy.Workflow.Persist'] = false
      vi.spyOn(useWorkflowStore(), 'loadWorkflows').mockResolvedValue()

      const { restoreWorkflowTabsState } = mountWorkflowPersistence()
      await restoreWorkflowTabsState()

      expect(openWorkflowMock).not.toHaveBeenCalled()
    })
  })

  describe('loadDefaultWorkflow', () => {
    it('reports a fresh start for first-time users', async () => {
      const { initializeWorkflow } = mountWorkflowPersistence()

      await expect(initializeWorkflow()).resolves.toBe('fresh')
      expect(loadBlankWorkflowMock).toHaveBeenCalled()
    })

    it('does not mark the tutorial completed on a reload before the user chose anything', async () => {
      loadBlankWorkflowMock.mockImplementation(loadBlankIntoActiveWorkflow)

      await mountWorkflowPersistence().initializeWorkflow()
      await nextTick()
      await mountWorkflowPersistence().initializeWorkflow()

      expect(
        useSettingStore().settingValues['Comfy.TutorialCompleted'],
        'Startup must not mark the tutorial completed; deciding that is the onboarding entry point’s job, not the graph loader’s'
      ).toBeUndefined()
    })

    it('still reports fresh on a reload before the user touched anything', async () => {
      loadBlankWorkflowMock.mockImplementation(loadBlankIntoActiveWorkflow)

      await mountWorkflowPersistence().initializeWorkflow()
      await nextTick()

      await expect(
        mountWorkflowPersistence().initializeWorkflow(),
        'Persisting the blank canvas startup opened would make boot 2 report restored, stranding a first-run user as a returning one'
      ).resolves.toBe('fresh')
    })

    it('keeps working on the blank canvas the user then edits', async () => {
      loadBlankWorkflowMock.mockImplementation(loadBlankIntoActiveWorkflow)

      await mountWorkflowPersistence().initializeWorkflow()
      await nextTick()

      mocks.state.currentGraph = { nodes: [{ id: 1, type: 'KSampler' }] }
      mocks.state.graphChangedHandler?.()
      await vi.runAllTimersAsync()

      await expect(
        mountWorkflowPersistence().initializeWorkflow(),
        'Dropping the startup blank must not stop the user’s own edits to it from being saved'
      ).resolves.toBe('restored')
    })

    it('restores a workflow the user opened after startup', async () => {
      loadBlankWorkflowMock.mockImplementation(loadBlankIntoActiveWorkflow)
      const workflowStore = useWorkflowStore()

      await mountWorkflowPersistence().initializeWorkflow()
      await nextTick()

      mocks.state.currentGraph = { nodes: [{ id: 1, type: 'KSampler' }] }
      await workflowStore.openWorkflow(
        workflowStore.createTemporary('single_ksampler.json')
      )
      await nextTick()

      await expect(
        mountWorkflowPersistence().initializeWorkflow(),
        'A workflow the user opened must survive a reload'
      ).resolves.toBe('restored')
    })

    it('persists a temporary workflow once the user has modified it', async () => {
      loadBlankWorkflowMock.mockImplementation(async () => {
        const workflowStore = useWorkflowStore()
        const blank = workflowStore.createTemporary('unsaved-workflow.json')
        blank.isModified = true
        await workflowStore.openWorkflow(blank)
      })

      await mountWorkflowPersistence().initializeWorkflow()
      await nextTick()

      await expect(
        mountWorkflowPersistence().initializeWorkflow(),
        'Real unsaved work must survive a reload'
      ).resolves.toBe('restored')
    })

    it('reports restored for a user who already completed the tutorial', async () => {
      useSettingStore().settingValues['Comfy.TutorialCompleted'] = true

      const { initializeWorkflow } = mountWorkflowPersistence()

      await expect(
        initializeWorkflow(),
        'Reporting fresh here would drop the full-screen onboarding takeover onto a returning user'
      ).resolves.toBe('restored')
      expect(loadBlankWorkflowMock).not.toHaveBeenCalled()
    })

    it('reports restored when saved tabs drive startup', async () => {
      writeTabState(['workflows/a.json'], 0)
      vi.spyOn(useWorkflowStore(), 'loadWorkflows').mockResolvedValue()

      const { initializeWorkflow } = mountWorkflowPersistence()

      await expect(
        initializeWorkflow(),
        'Restoring tabs is a returning user; reporting fresh would take the screen over their restored session'
      ).resolves.toBe('restored')
    })

    it.for([
      ['share param in URL', () => (routeMocks.query = { share: 'id' })],
      [
        'share intent preserved across /user-select redirect',
        () => (preservedQueryMocks.payloads.share = { share: 'id' })
      ],
      ['template param in URL', () => (routeMocks.query = { template: 'id' })],
      [
        'template intent preserved across /user-select redirect',
        () => (preservedQueryMocks.payloads.template = { template: 'id' })
      ]
    ] as const)(
      'reports url-intent, not fresh, with %s',
      async ([, applyIntent]) => {
        applyIntent()

        const { initializeWorkflow } = mountWorkflowPersistence()

        await expect(initializeWorkflow()).resolves.toBe('url-intent')
        expect(loadBlankWorkflowMock).toHaveBeenCalled()
      }
    )
  })

  it('flushes a pending workflow edit when the page is unloaded', async () => {
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('Draft.json').load()
    workflowStore.activeWorkflow = workflow
    mountWorkflowPersistence()
    await nextTick()

    mocks.state.currentGraph = {
      nodes: [],
      extra: { marker: 'final-edit' }
    }
    mocks.state.graphChangedHandler?.()

    const payloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope('personal')
    )
    expect(localStorage.getItem(payloadKey)).toBeNull()

    window.dispatchEvent(new PageTransitionEvent('pagehide'))

    const payload = JSON.parse(localStorage.getItem(payloadKey)!)
    expect(JSON.parse(payload.data)).toEqual({
      nodes: [],
      extra: { marker: 'final-edit' }
    })
  })

  it('does not revive a pending edit after persistence was disabled', async () => {
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('Draft.json').load()
    workflowStore.activeWorkflow = workflow
    mountWorkflowPersistence()
    await nextTick()

    mocks.state.currentGraph = { marker: 'disabled-edit' }
    mocks.state.graphChangedHandler?.()
    useSettingStore().settingValues['Comfy.Workflow.Persist'] = false
    await nextTick()
    await vi.runAllTimersAsync()

    useSettingStore().settingValues['Comfy.Workflow.Persist'] = true
    await nextTick()
    const reopenGate = storageIO.prepareWorkflowWorkspaceTransition()
    reopenGate()
    await nextTick()

    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(workflow.path, scope('personal'))
      )
    ).toBeNull()
  })

  it('does not revive a pending edit after its active workflow disappeared', async () => {
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('Draft.json').load()
    workflowStore.activeWorkflow = workflow
    mountWorkflowPersistence()
    await nextTick()

    mocks.state.currentGraph = { marker: 'orphaned-edit' }
    mocks.state.graphChangedHandler?.()
    workflowStore.activeWorkflow = null
    await vi.runAllTimersAsync()

    workflowStore.activeWorkflow = workflow
    const reopenGate = storageIO.prepareWorkflowWorkspaceTransition()
    reopenGate()

    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(workflow.path, scope('personal'))
      )
    ).toBeNull()
    await nextTick()
  })

  it('does not revive an unchanged edit when the write gate reopens', async () => {
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('Draft.json').load()
    workflowStore.activeWorkflow = workflow
    mountWorkflowPersistence()
    await nextTick()

    mocks.state.currentGraph = { marker: 'saved' }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()
    mocks.state.currentGraph = { marker: 'must-not-revive' }
    const reopenGate = storageIO.prepareWorkflowWorkspaceTransition()
    reopenGate()
    await nextTick()

    const payload = JSON.parse(
      localStorage.getItem(
        StorageKeys.draftPayload(workflow.path, scope('personal'))
      )!
    )
    expect(JSON.parse(payload.data)).toEqual({ marker: 'saved' })
  })

  it('does not flush a pending workflow edit after disposal', async () => {
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('Draft.json').load()
    workflowStore.activeWorkflow = workflow
    mountWorkflowPersistence()

    mocks.state.currentGraph = { nodes: [] }
    const graphChangedHandler = mocks.state.graphChangedHandler
    if (!graphChangedHandler) {
      throw new Error('Graph change handler was not registered')
    }
    graphChangedHandler()

    const mounted = mountedApps.pop()
    if (!mounted) throw new Error('Failed to find mounted persistence app')
    mounted.app.unmount()
    mounted.container.remove()

    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    await vi.runAllTimersAsync()

    expect(
      localStorage.getItem(
        StorageKeys.draftPayload(workflow.path, scope('personal'))
      )
    ).toBeNull()
  })

  it('flushes the final source-workspace edit before blocking transition writes', async () => {
    distributionMocks.isCloud = true
    const sourceWorkspaceId = 'workspace-a'
    const destinationWorkspaceId = 'workspace-b'
    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ id: sourceWorkspaceId, type: 'team' })
    )

    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore
      .createTemporary('WorkspaceA.json')
      .load()
    workflowStore.activeWorkflow = workflow
    mountWorkflowPersistence()
    resolveUser('user-a')
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: sourceWorkspaceId,
      initState: 'ready'
    })
    await nextTick()

    mocks.state.currentGraph = {
      nodes: [],
      extra: { marker: 'workspace-a-final-edit' }
    }
    mocks.state.graphChangedHandler?.()

    const sourcePayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope(`user-a:${sourceWorkspaceId}`)
    )
    const destinationPayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope(`user-a:${destinationWorkspaceId}`)
    )
    expect(localStorage.getItem(sourcePayloadKey)).toBeNull()

    const cancelTransition = storageIO.prepareWorkflowWorkspaceTransition()
    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ id: destinationWorkspaceId, type: 'team' })
    )
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: destinationWorkspaceId,
      initState: 'ready'
    })
    mocks.state.currentGraph = {
      nodes: [],
      extra: { marker: 'late-source-write' }
    }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    const sourcePayloadJson = localStorage.getItem(sourcePayloadKey)
    expect(sourcePayloadJson).not.toBeNull()
    if (sourcePayloadJson === null) {
      throw new Error(
        'Expected source payload to be persisted before transition'
      )
    }
    const sourcePayload = JSON.parse(sourcePayloadJson)
    expect(JSON.parse(sourcePayload.data)).toEqual({
      nodes: [],
      extra: { marker: 'workspace-a-final-edit' }
    })
    expect(localStorage.getItem(destinationPayloadKey)).toBeNull()
    expect(
      sessionStorage.getItem(StorageKeys.activePath('test-client'))
    ).toBeNull()
    expect(
      sessionStorage.getItem(StorageKeys.openPaths('test-client'))
    ).toBeNull()
    cancelTransition()
    await nextTick()

    const destinationPayloadJson = localStorage.getItem(destinationPayloadKey)
    expect(destinationPayloadJson).not.toBeNull()
    if (destinationPayloadJson === null) {
      throw new Error('Expected deferred destination payload to be persisted')
    }
    const destinationPayload = JSON.parse(destinationPayloadJson)
    expect(JSON.parse(destinationPayload.data)).toEqual({
      nodes: [],
      extra: { marker: 'late-source-write' }
    })
  })

  it('resumes workflow writes once workspace readiness is confirmed after authentication recovers', async () => {
    distributionMocks.isCloud = true
    localStorage.setItem('Comfy.Workflow.DraftIndex.v2:workspace-a', '{}')
    sessionStorage.setItem('Comfy.Workflow.ActivePath:test-client', '{}')
    mountWorkflowPersistence()

    expect(
      localStorage.getItem('Comfy.Workflow.DraftIndex.v2:workspace-a')
    ).toBe('{}')
    expect(
      storageIO.writePayload(scope('user-a:workspace-a'), 'blocked', {
        data: '{}',
        updatedAt: 1
      })
    ).toBe(false)

    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ id: 'workspace-a', type: 'team' })
    )
    resolveUser('user-a')

    expect(
      storageIO.writePayload(scope('user-a:workspace-a'), 'still-blocked', {
        data: '{}',
        updatedAt: 2
      })
    ).toBe(false)

    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    Object.assign(useTeamWorkspaceStore(), { initState: 'ready' })
    await nextTick()

    expect(
      storageIO.writePayload(scope('user-a:workspace-a'), 'resumed', {
        data: '{}',
        updatedAt: 3
      })
    ).toBe(true)
  })

  it('cancels stale workspace-readiness watchers across authentication episodes', async () => {
    distributionMocks.isCloud = true
    const completeTransitionSpy = vi.spyOn(
      storageIO,
      'completeWorkflowLogoutTransition'
    )
    mountWorkflowPersistence()

    resolveUser('user-b')
    logoutUser()
    resolveUser('user-c')

    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-c' })
    Object.assign(useTeamWorkspaceStore(), { initState: 'ready' })
    await nextTick()

    expect(completeTransitionSpy).toHaveBeenCalledOnce()
  })

  it('releases the write fence when workspace initialization fails permanently', async () => {
    distributionMocks.isCloud = true
    const completeTransitionSpy = vi.spyOn(
      storageIO,
      'completeWorkflowLogoutTransition'
    )
    mountWorkflowPersistence()

    resolveUser('user-a')

    expect(completeTransitionSpy).not.toHaveBeenCalled()

    Object.assign(useTeamWorkspaceStore(), { initState: 'error' })
    await nextTick()

    expect(completeTransitionSpy).toHaveBeenCalledOnce()
  })

  it('waits for workspace readiness and drops pending pre-logout edits', async () => {
    distributionMocks.isCloud = true
    const sourceWorkspaceId = 'workspace-a'
    const destinationWorkspaceId = 'workspace-b'
    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ id: sourceWorkspaceId, type: 'team' })
    )
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore
      .createTemporary('LogoutRecovery.json')
      .load()
    workflowStore.activeWorkflow = workflow
    mountWorkflowPersistence()
    resolveUser('user-a')
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: sourceWorkspaceId,
      initState: 'ready'
    })
    await nextTick()
    mocks.state.currentGraph = { marker: 'stale-source-edit' }
    mocks.state.graphChangedHandler?.()

    logoutUser()
    mocks.state.currentGraph = { marker: 'ownerless-gap-edit' }
    mocks.state.graphChangedHandler?.()
    resolveUser('user-b')
    await vi.runAllTimersAsync()

    const sourcePayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope(`user-a:${sourceWorkspaceId}`)
    )
    const destinationPayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope(`user-b:${destinationWorkspaceId}`)
    )
    const personalPayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope('personal')
    )
    expect(localStorage.getItem(sourcePayloadKey)).toBeNull()
    expect(localStorage.getItem(destinationPayloadKey)).toBeNull()
    expect(localStorage.getItem(personalPayloadKey)).toBeNull()

    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
      JSON.stringify({ id: destinationWorkspaceId, type: 'team' })
    )
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: destinationWorkspaceId
    })
    Object.assign(useTeamWorkspaceStore(), { initState: 'ready' })
    await nextTick()

    const destinationWorkflow = await workflowStore
      .createTemporary('DestinationAfterLogout.json')
      .load()
    workflowStore.activeWorkflow = destinationWorkflow
    workflowStore.openWorkflowsInBackground({
      right: [destinationWorkflow.path]
    })
    mocks.state.currentGraph = { marker: 'destination-edit' }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    const destinationOwnedPayloadKey = StorageKeys.draftPayload(
      destinationWorkflow.path,
      scope(`user-b:${destinationWorkspaceId}`)
    )
    expect(localStorage.getItem(sourcePayloadKey)).toBeNull()
    expect(localStorage.getItem(personalPayloadKey)).toBeNull()
    expect(localStorage.getItem(destinationPayloadKey)).toBeNull()
    expect(localStorage.getItem(destinationOwnedPayloadKey)).not.toBeNull()
  })

  it('does not adopt live workflows during a direct identity replacement', async () => {
    distributionMocks.isCloud = true
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore.createTemporary('AccountA.json').load()
    workflowStore.activeWorkflow = workflow
    workflowStore.openWorkflowsInBackground({ right: [workflow.path] })
    const teamWorkspaceStore = useTeamWorkspaceStore()
    vi.spyOn(teamWorkspaceStore, 'initialize').mockResolvedValue()
    mountWorkflowPersistence()

    resolveUser('user-a')
    Object.assign(teamWorkspaceStore, {
      activeWorkspaceId: 'workspace-1',
      initState: 'ready'
    })
    await nextTick()

    mocks.state.currentGraph = { marker: 'account-a' }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    const sourcePayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope('user-a:workspace-1')
    )
    const destinationPayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope('user-b:workspace-1')
    )
    expect(localStorage.getItem(sourcePayloadKey)).not.toBeNull()

    resolveUser('user-b')
    Object.assign(teamWorkspaceStore, {
      activeWorkspaceId: 'workspace-1',
      initState: 'ready'
    })
    await nextTick()

    mocks.state.currentGraph = { marker: 'must-not-cross-owners' }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    expect(workflowStore.activeWorkflow).toBeNull()
    expect(workflowStore.openWorkflows).toEqual([])
    expect(localStorage.getItem(destinationPayloadKey)).toBeNull()
    expect(
      localStorage.getItem(
        StorageKeys.lastOpenPaths(scope('user-b:workspace-1'))
      )
    ).toBeNull()
  })

  it('drops edits made in a post-identity null gap before the next owner resolves', async () => {
    distributionMocks.isCloud = true
    const workflowStore = useWorkflowStore()
    const workflow = await workflowStore
      .createTemporary('IdentityGap.json')
      .load()
    workflowStore.activeWorkflow = workflow
    const teamWorkspaceStore = useTeamWorkspaceStore()
    mountWorkflowPersistence()

    Object.assign(teamWorkspaceStore, {
      activeWorkspaceId: 'workspace-a',
      initState: 'ready'
    })
    resolveUser('user-a')
    await nextTick()

    logoutUser()
    mocks.state.currentGraph = { marker: 'ownerless-gap-edit' }
    mocks.state.graphChangedHandler?.()

    resolveUser('user-b')
    Object.assign(teamWorkspaceStore, {
      activeWorkspaceId: 'workspace-b',
      initState: 'ready'
    })
    await nextTick()
    await vi.runAllTimersAsync()

    const destinationPayloadKey = StorageKeys.draftPayload(
      workflow.path,
      scope('user-b:workspace-b')
    )
    expect(localStorage.getItem(destinationPayloadKey)).toBeNull()

    const destinationWorkflow = await workflowStore
      .createTemporary('Destination.json')
      .load()
    workflowStore.activeWorkflow = destinationWorkflow
    workflowStore.openWorkflowsInBackground({
      right: [destinationWorkflow.path]
    })
    mocks.state.currentGraph = { marker: 'destination-edit' }
    mocks.state.graphChangedHandler?.()
    await vi.runAllTimersAsync()

    const destinationOwnedPayloadKey = StorageKeys.draftPayload(
      destinationWorkflow.path,
      scope('user-b:workspace-b')
    )
    const destinationPayloadJson = localStorage.getItem(destinationPayloadKey)
    expect(destinationPayloadJson).toBeNull()
    const destinationOwnedPayloadJson = localStorage.getItem(
      destinationOwnedPayloadKey
    )
    expect(destinationOwnedPayloadJson).not.toBeNull()
    if (destinationOwnedPayloadJson === null) {
      throw new Error('Expected destination draft payload')
    }
    expect(JSON.parse(JSON.parse(destinationOwnedPayloadJson).data)).toEqual({
      marker: 'destination-edit'
    })
  })
})
