import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { createApp, defineComponent, markRaw, nextTick, ref, toRaw } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import { attachLegacyUI } from '@/core/legacyUI/attachLegacyUI'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import * as distributionModule from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import * as modelPipeline from '@/platform/workflowErrors/missingModel/missingModelPipeline'
import * as mediaPipeline from '@/platform/workflowErrors/missingMedia/missingMediaPipeline'
import {
  useWorkflowService,
  resetWorkflowLoadQueueForTests
} from '@/platform/workflow/core/services/workflowService'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowPersistenceV2 } from '@/platform/workflow/persistence/composables/useWorkflowPersistenceV2'
import { useWorkflowDraftStoreV2 } from '@/platform/workflow/persistence/stores/workflowDraftStoreV2'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { resetStorageAvailable } from '@/platform/workflow/persistence/base/storageIO'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import { api } from '@/scripts/api'
import { ComfyApp, app as singletonApp } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import type { useExtensionService } from '@/platform/extensions/services/extensionService'
import { useAuthStore } from '@/stores/authStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { createMockChangeTracker } from '@/utils/__tests__/litegraphTestUtils'
import { createTestDragAndScale } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/workflowErrors/missingModel/missingModelPipeline'), {
  spy: true
})
vi.mock(import('@/platform/workflowErrors/missingMedia/missingMediaPipeline'), {
  spy: true
})
vi.mock(import('@/platform/distribution/types'), { spy: true })
vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))

const mockExtensionService = vi.hoisted(() => ({
  invokeExtensions: vi.fn(() => []),
  invokeExtensionsAsync:
    vi.fn<ReturnType<typeof useExtensionService>['invokeExtensionsAsync']>()
}))

vi.mock(import('@/platform/extensions/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>(mockExtensionService)
}))

const apiEvents: EventTarget = api

function createWorkflowGraphData(): ComfyWorkflowJSON {
  return {
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

async function markLoaded(
  workflow: ComfyWorkflow
): Promise<LoadedComfyWorkflow> {
  workflow.changeTracker = createMockChangeTracker()
  workflow.content = '{}'
  workflow.originalContent = '{}'
  return workflow.load()
}

function createMockCanvas(): Partial<LGraphCanvas> {
  return {
    draw: vi.fn(),
    selectItems: vi.fn(),
    setDirty: vi.fn(),
    setGraph: vi.fn()
  }
}

describe('saved workflow handoff persistence', () => {
  let app: ComfyApp
  let mockCanvas: LGraphCanvas

  beforeEach(() => {
    resetWorkflowLoadQueueForTests()
    resetStorageAvailable()
    app = new ComfyApp()
    useWorkflowStore().activeWorkflow = null
    useAuthStore().currentUser = null
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-a',
      workspaceTransitionGeneration: 0
    })
    useSettingStore().settingValues['Comfy.Validation.Workflows'] = false
    mockExtensionService.invokeExtensions.mockReturnValue([])
    mockExtensionService.invokeExtensionsAsync.mockResolvedValue([])
    vi.mocked(useSubgraphNavigationStore().updateHash).mockResolvedValue(
      undefined
    )
    vi.mocked(
      useSubgraphNavigationStore().saveCurrentViewport
    ).mockImplementation(() => {})
    vi.mocked(useSubgraphNavigationStore().exportState).mockReturnValue([])
    vi.mocked(useSubgraphNavigationStore().restoreState).mockImplementation(
      () => {}
    )
  })

  async function prepareRetainedHandoff() {
    app.canvasElRef.value = document.createElement('canvas')
    const graph = new LGraph()
    graph.extra = { marker: 'dirty retained document' }
    LiteGraph.registerNodeType('test/Retained', LGraphNode)
    const retainedNode = LiteGraph.createNode('test/Retained')
    assert.exists(retainedNode)
    retainedNode.title = 'Keep my edits'
    graph.add(retainedNode)
    Reflect.set(app, 'rootGraphInternal', graph)
    const previousGraph = singletonApp.rootGraphOrUndefined
    const previousCanvas = singletonApp.canvasOrUndefined
    Reflect.set(singletonApp, 'rootGraphInternal', graph)
    mockCanvas = fromPartial<LGraphCanvas>({
      ...createMockCanvas(),
      ds: createTestDragAndScale(),
      graph
    })
    app.canvas = mockCanvas
    singletonApp.canvas = mockCanvas
    onTestFinished(attachLegacyUI(singletonApp))
    onTestFinished(() => {
      Reflect.set(singletonApp, 'rootGraphInternal', previousGraph)
      Reflect.set(singletonApp, 'canvasInternal', previousCanvas)
    })
    vi.spyOn(singletonApp, 'loadGraphData').mockImplementation(
      app.loadGraphData.bind(app)
    )
    const service = useWorkflowService()
    vi.mocked(
      useSubgraphNavigationStore().endWorkflowNavigation
    ).mockImplementation(() => {})
    vi.mocked(useWorkflowStore().openWorkflow).mockRestore()
    vi.mocked(useWorkflowStore().isActive).mockRestore()
    vi.mocked(useWorkflowStore().getWorkflowByPath).mockRestore()
    const retained = new ComfyWorkflow({
      path: 'workflows/retained.json',
      modified: 1,
      size: 1
    })
    const saved = {
      ...createWorkflowGraphData(),
      id: graph.id,
      extra: { marker: 'saved retained document' }
    }
    retained.content = retained.originalContent = JSON.stringify(saved)
    retained.changeTracker = markRaw(new ChangeTracker(retained, saved))
    retained.isModified = true
    useWorkflowStore().attachWorkflow(retained)
    const retainedDocument = await useWorkflowStore().openWorkflow(retained)
    const incoming = await markLoaded(
      new ComfyWorkflow({
        path: 'workflows/incoming.json',
        modified: 1,
        size: 1
      })
    )
    incoming.changeTracker.activeState = {
      ...createWorkflowGraphData(),
      id: graph.id,
      extra: { marker: 'superseded incoming document' }
    }
    useSettingStore().settingValues['Comfy.Workflow.Persist'] = true
    let persistence: ReturnType<typeof useWorkflowPersistenceV2> | undefined
    const host = createApp(
      defineComponent({
        setup() {
          persistence = useWorkflowPersistenceV2()
          return () => null
        }
      })
    )
    host.use(createI18n({ legacy: false, locale: 'en', messages: {} }))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => null } }]
    })
    await router.push('/')
    host.use(router)
    const container = document.createElement('div')
    document.body.appendChild(container)
    onTestFinished(() => {
      host.unmount()
      container.remove()
    })
    const previousClientId = api.clientId
    api.clientId = 'handoff-client'
    onTestFinished(() => {
      api.clientId = previousClientId
    })
    host.mount(container)
    assert.exists(persistence)
    vi.mocked(useWorkflowStore().loadWorkflows).mockResolvedValue()
    await persistence.restoreWorkflowTabsState()
    const other = await markLoaded(
      new ComfyWorkflow({
        path: 'workflows/other.json',
        modified: 1,
        size: 1
      })
    )
    useWorkflowStore().attachWorkflow(other, 1)
    await nextTick()
    return { graph, service, retained, retainedDocument, incoming, saved }
  }

  it.for([false, true])(
    'preserves and refuses an unknown-ID startup draft colliding with a known saved file (temporary=%s)',
    async (isTemporary) => {
      const { retainedDocument, graph } = await prepareRetainedHandoff()
      const identity = {
        id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        ownerId: 'user-a',
        workspaceId: 'workspace-a'
      }
      const replacement = new ComfyWorkflow({
        path: 'workflows/legacy-collision.json',
        modified: 1,
        size: 20,
        savedFileIdentity: identity
      })
      useWorkflowStore().attachWorkflow(replacement)
      const drafts = useWorkflowDraftStoreV2()
      drafts.saveDraft(
        replacement.path,
        JSON.stringify(createWorkflowGraphData()),
        { name: replacement.key, isTemporary }
      )
      const before = drafts.getDraft(replacement.path)
      vi.mocked(singletonApp.loadGraphData).mockClear()
      expect(
        await drafts.loadPersistedWorkflow({
          preferredPath: replacement.path,
          fallbackToLatestDraft: true
        })
      ).toBe(false)
      expect(singletonApp.loadGraphData).not.toHaveBeenCalled()
      expect(toRaw(useWorkflowStore().activeWorkflow)).toBe(
        toRaw(retainedDocument)
      )
      expect(graph.nodes[0]?.title).toBe('Keep my edits')
      expect(drafts.getDraft(replacement.path)).toEqual(before)
      expect(replacement.content).toBeNull()
    }
  )

  it.for([
    {
      boundary: 'change tracking',
      capture: (workflow: LoadedComfyWorkflow) =>
        workflow.changeTracker.prepareForSave()
    },
    {
      boundary: 'pagehide persistence',
      capture: () => {
        apiEvents.dispatchEvent(new Event('graphChanged'))
        window.dispatchEvent(new PageTransitionEvent('pagehide'))
      }
    }
  ])(
    'keeps retained document edits after cancellation during configuration and $boundary',
    async ({ capture }) => {
      const { graph, service, retained, retainedDocument, incoming, saved } =
        await prepareRetainedHandoff()
      let current = true
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'afterConfigureGraph') {
            capture(retainedDocument)
            expect(
              JSON.parse(
                useWorkflowDraftStoreV2().getDraft(retained.path)?.data ?? '{}'
              ).extra
            ).toEqual({ marker: 'dirty retained document' })
            current = false
          }
          return []
        }
      )

      await expect(
        service.openWorkflow(incoming, { isCurrent: () => current })
      ).resolves.toBe(false)
      capture(retainedDocument)

      expect(useWorkflowStore().activeWorkflow).toBeNull()
      expect(graph.extra.marker).toBeUndefined()
      expect(retained.activeState?.extra).toEqual({
        marker: 'dirty retained document'
      })
      expect(
        JSON.parse(
          useWorkflowDraftStoreV2().getDraft(retained.path)?.data ?? '{}'
        ).extra
      ).toEqual({ marker: 'dirty retained document' })
      expect(retained.isModified).toBe(true)
      expect(retainedDocument.changeTracker.undoQueue).toEqual([saved])
      expect(
        useWorkflowStore().openWorkflows.map((workflow) => workflow.path)
      ).toContain(retained.path)
      expect((await app.graphToPrompt()).output).toEqual({})
      await nextTick()
      expect(
        JSON.parse(
          sessionStorage.getItem(StorageKeys.openPaths('handoff-client')) ??
            '{}'
        )
      ).toMatchObject({
        paths: ['workflows/retained.json', 'workflows/other.json'],
        activeIndex: 0
      })

      await expect(service.openWorkflow(retained)).resolves.toBe(true)

      expect(useWorkflowStore().activeWorkflow?.path).toBe(retained.path)
      expect(graph.nodes.map((node) => node.title)).toEqual(['Keep my edits'])
      expect(graph.extra.marker).toBe('dirty retained document')
    }
  )

  it.for([
    {
      boundary: 'activation',
      cancelAt: (cancel: () => void, incoming: LoadedComfyWorkflow) => {
        const store = useWorkflowStore()
        const open = vi.mocked(store.openWorkflow).getMockImplementation()
        assert.exists(open)
        vi.spyOn(store, 'openWorkflow').mockImplementation(async (...args) => {
          const loaded = await open(...args)
          if (args[0] === incoming) cancel()
          return loaded
        })
      }
    },
    {
      boundary: 'tracker restoration rejection',
      cancelAt: (cancel: () => void, incoming: LoadedComfyWorkflow) => {
        vi.mocked(incoming.changeTracker.restore).mockImplementationOnce(() => {
          cancel()
          throw new Error('tracker restoration rejected after activation')
        })
      }
    },
    {
      boundary: 'afterLoadGraph',
      cancelAt: (cancel: () => void) => {
        mockExtensionService.invokeExtensionsAsync.mockImplementation(
          async (hook) => {
            if (hook === 'afterLoadGraph') cancel()
            return []
          }
        )
      }
    },
    {
      boundary: 'model verification',
      cancelAt: (cancel: () => void) => {
        vi.mocked(modelPipeline.runMissingModelPipeline).mockImplementationOnce(
          async () => {
            cancel()
            return { missingModels: [], confirmedCandidates: [] }
          }
        )
      }
    },
    {
      boundary: 'media verification',
      cancelAt: (cancel: () => void) => {
        vi.mocked(mediaPipeline.runMissingMediaPipeline).mockImplementationOnce(
          async () => {
            cancel()
          }
        )
      }
    }
  ])(
    'clears only its own activated canvas after cancellation during $boundary',
    async ({ cancelAt }) => {
      const { graph, service, retained, retainedDocument, incoming, saved } =
        await prepareRetainedHandoff()
      vi.mocked(modelPipeline.runMissingModelPipeline).mockResolvedValue({
        missingModels: [],
        confirmedCandidates: []
      })
      vi.mocked(mediaPipeline.runMissingMediaPipeline).mockResolvedValue(
        undefined
      )
      let current = true
      cancelAt(() => {
        current = false
      }, incoming)

      await expect(
        service.openWorkflow(incoming, {
          force: true,
          isCurrent: () => current
        })
      ).resolves.toBe(false)

      expect(useWorkflowStore().activeWorkflow).toBeNull()
      expect(graph.extra.marker).toBeUndefined()
      expect((await app.graphToPrompt()).output).toEqual({})
      expect(retained.activeState?.extra?.marker).toBe(
        'dirty retained document'
      )
      expect(retainedDocument.changeTracker.undoQueue).toEqual([saved])
      expect(retained.isModified).toBe(true)
      await expect(service.openWorkflow(retained)).resolves.toBe(true)
      expect(graph.nodes.map((node) => node.title)).toEqual(['Keep my edits'])
    }
  )

  it.for([
    {
      boundary: 'graph',
      replace: async (graph: LGraph, _incoming: LoadedComfyWorkflow) => {
        graph.configure({
          ...graph.serialize(),
          extra: { marker: 'newer graph' }
        })
      },
      marker: 'newer graph',
      path: 'workflows/incoming.json'
    },
    {
      boundary: 'document selection',
      replace: async (_graph: LGraph, _incoming: LoadedComfyWorkflow) => {
        const store = useWorkflowStore()
        const next = store.getWorkflowByPath('workflows/other.json')
        assert.exists(next)
        await store.openWorkflow(next)
      },
      marker: 'superseded incoming document',
      path: 'workflows/other.json'
    }
  ])(
    'does not adopt a newer $boundary while activation settles',
    async ({ replace, marker, path }) => {
      const { graph, service, incoming } = await prepareRetainedHandoff()
      let current = true
      const store = useWorkflowStore()
      const open = vi.mocked(store.openWorkflow).getMockImplementation()
      assert.exists(open)
      vi.spyOn(store, 'openWorkflow').mockImplementation(async (...args) => {
        const loaded = await open(...args)
        if (args[0] === incoming) {
          await replace(graph, incoming)
          current = false
        }
        return loaded
      })

      await expect(
        service.openWorkflow(incoming, { isCurrent: () => current })
      ).resolves.toBe(false)

      expect(graph.extra.marker).toBe(marker)
      expect(store.activeWorkflow?.path).toBe(path)
    }
  )

  it.for([
    {
      change: 'workspace switch',
      transition: async () => {
        const workspaceStore = useTeamWorkspaceStore()
        workspaceStore.workspaces = [
          {
            id: 'workspace-b',
            name: 'Workspace B',
            type: 'team',
            role: 'owner',
            created_at: '2026-10-27T00:00:00Z',
            joined_at: '2026-10-27T00:00:00Z',
            members: [],
            membersLoaded: false,
            pendingInvites: [],
            pendingInvitesLoaded: false
          }
        ]
        await workspaceStore.switchWorkspace('workspace-b')
        sessionStorage.setItem(
          WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
          JSON.stringify({ id: 'workspace-b', type: 'team' })
        )
      },
      destinationScope: 'user-a:workspace-b',
      expectedSourceMarker: 'dirty retained document'
    },
    {
      change: 'sign-out',
      transition: async () => {
        useAuthStore().currentUser = null
        await nextTick()
      },
      destinationScope: 'unauthenticated:personal',
      expectedSourceMarker: null
    }
  ])(
    'does not persist the pending source canvas in a new storage scope after $change',
    async ({ transition, destinationScope, expectedSourceMarker }) => {
      vi.spyOn(distributionModule, 'isCloud', 'get').mockReturnValue(true)
      vi.spyOn(window.location, 'reload').mockImplementation(() => {})
      onTestFinished(resetStorageAvailable)
      useAuthStore().currentUser = fromPartial<User>({ uid: 'user-a' })
      useAuthStore().isInitialized = true
      sessionStorage.setItem(
        WORKSPACE_STORAGE_KEYS.CURRENT_WORKSPACE,
        JSON.stringify({ id: 'workspace-a', type: 'team' })
      )
      Object.assign(useTeamWorkspaceStore(), { initState: 'ready' })
      const { graph, service, retained, incoming, saved } =
        await prepareRetainedHandoff()
      const userId = useAuthStore().userId
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'afterConfigureGraph') {
            apiEvents.dispatchEvent(new Event('graphChanged'))
            await transition()
            apiEvents.dispatchEvent(new Event('graphChanged'))
            window.dispatchEvent(new PageTransitionEvent('pagehide'))
          }
          return []
        }
      )

      await expect(
        service.openWorkflow(incoming, {
          isCurrent: () =>
            useAuthStore().userId === userId &&
            !useTeamWorkspaceStore().isSwitching
        })
      ).resolves.toBe(false)

      expect(useWorkflowStore().activeWorkflow).toBeNull()
      expect((await app.graphToPrompt()).output).toEqual({})
      expect(graph.extra.marker).toBeUndefined()
      expect(retained.activeState?.extra?.marker).toBe(
        'dirty retained document'
      )
      expect(retained.changeTracker?.undoQueue).toEqual([saved])
      expect(
        localStorage.getItem(
          StorageKeys.draftPayload(retained.path, destinationScope)
        )
      ).toBeNull()
      const sourcePayload = JSON.parse(
        localStorage.getItem(
          StorageKeys.draftPayload(retained.path, 'user-a:workspace-a')
        ) ?? 'null'
      )
      expect(
        JSON.parse(sourcePayload?.data ?? 'null')?.extra?.marker ?? null
      ).toBe(expectedSourceMarker)
    }
  )
})
