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

import { useSavedWorkflowUrlLoader } from '@/composables/useSavedWorkflowUrlLoader'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { registerUserFileScopeProvider } from '@/platform/remote/comfyui/userFileIdentity'
import { useDialogService } from '@/services/dialogService'
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
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
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
vi.mock(import('@/services/dialogService'))
vi.mock(import('@comfyorg/telemetry'))
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

  async function prepareRetainedHandoff({
    withUrlLoader = false,
    restoreTabs = true
  }: { withUrlLoader?: boolean; restoreTabs?: boolean } = {}) {
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
    let savedFileLoader:
      | ReturnType<typeof useSavedWorkflowUrlLoader>
      | undefined
    let persistence: ReturnType<typeof useWorkflowPersistenceV2> | undefined
    const host = createApp(
      defineComponent({
        setup() {
          persistence = useWorkflowPersistenceV2()
          if (withUrlLoader) savedFileLoader = useSavedWorkflowUrlLoader()
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
    if (restoreTabs) await persistence.restoreWorkflowTabsState()
    const other = await markLoaded(
      new ComfyWorkflow({
        path: 'workflows/other.json',
        modified: 1,
        size: 1
      })
    )
    useWorkflowStore().attachWorkflow(other, 1)
    await nextTick()
    return {
      graph,
      service,
      retained,
      retainedDocument,
      incoming,
      saved,
      persistence,
      savedFileLoader,
      router
    }
  }

  it.for(['revoked', 'prompt', 'overwrite'] as const)(
    'refuses UI Save As before destructive effects after source revocation at %s',
    async (boundary) => {
      const { service, retainedDocument } = await prepareRetainedHandoff()
      const scope = ref({ ownerId: 'user-a', workspaceId: 'workspace-a' })
      registerUserFileScopeProvider(() => scope.value)
      const identity = {
        ...scope.value,
        id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
      }
      retainedDocument.savedFileIdentity = identity
      const drafts = useWorkflowDraftStoreV2()
      drafts.removeDraft(retainedDocument.path)
      drafts.saveDraft(
        retainedDocument.path,
        JSON.stringify(retainedDocument.activeState),
        {
          name: retainedDocument.key,
          isTemporary: false,
          savedFileIdentity: identity
        }
      )
      const before = drafts.getDraft(retainedDocument.path)
      const destination = new ComfyWorkflow({
        path: 'workflows/copy.json',
        modified: 1,
        size: 10
      })
      useWorkflowStore().attachWorkflow(destination)
      const revoke = () => {
        scope.value = { ownerId: 'user-b', workspaceId: 'workspace-b' }
      }
      vi.mocked(useDialogService().prompt).mockImplementation(async () => {
        if (boundary === 'prompt') revoke()
        return 'copy'
      })
      vi.mocked(useDialogService().confirm).mockImplementation(async () => {
        if (boundary === 'overwrite') revoke()
        return true
      })
      vi.spyOn(api, 'deleteUserData').mockResolvedValue(
        new Response(null, { status: 204 })
      )
      vi.spyOn(api, 'storeUserData').mockImplementation(async () =>
        Response.json({
          id: '78ebcb5b-028d-45e8-9f9c-b20f433c364d',
          modified: 2,
          size: 20
        })
      )
      if (boundary === 'revoked') revoke()
      await expect(
        service.saveWorkflowAs(
          retainedDocument,
          boundary === 'prompt' ? {} : { filename: 'copy' }
        )
      ).resolves.toBe(false)
      expect(api.deleteUserData).not.toHaveBeenCalled()
      expect(api.storeUserData).not.toHaveBeenCalled()
      expect(
        toRaw(useWorkflowStore().getWorkflowByPath(destination.path))
      ).toBe(toRaw(destination))
      expect(drafts.getDraft(retainedDocument.path)).toEqual(before)
      expect(useTelemetry()?.trackWorkflowSaved).not.toHaveBeenCalled()
    }
  )

  it('preserves an open overwrite destination and its draft when scope leaves and returns while its close waits', async () => {
    const { service, retainedDocument } = await prepareRetainedHandoff()
    const originalScope = { ownerId: 'user-a', workspaceId: 'workspace-a' }
    const scope = ref(originalScope)
    registerUserFileScopeProvider(() => scope.value)
    retainedDocument.savedFileIdentity = {
      ...originalScope,
      id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
    }
    const drafts = useWorkflowDraftStoreV2()
    drafts.removeDraft(retainedDocument.path)
    const destination = new ComfyWorkflow({
      path: 'workflows/copy.json',
      modified: 1,
      size: 20
    })
    const destinationState = {
      ...createWorkflowGraphData(),
      extra: { marker: 'keep destination draft' }
    }
    destination.content = destination.originalContent =
      JSON.stringify(destinationState)
    destination.changeTracker = markRaw(
      new ChangeTracker(destination, destinationState)
    )
    useWorkflowStore().attachWorkflow(destination)
    expect(await service.openWorkflow(destination)).toBe(true)
    destination.changeTracker.captureCanvasState()
    drafts.saveDraft(
      destination.path,
      JSON.stringify(destination.activeState),
      { name: destination.key, isTemporary: false }
    )
    const before = drafts.getDraft(destination.path)
    let enter = () => {}
    const entered = new Promise<void>((resolve) => {
      enter = resolve
    })
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    mockExtensionService.invokeExtensionsAsync.mockImplementation(
      async (hook) => {
        if (hook === 'afterConfigureGraph') {
          enter()
          await gate
        }
        return []
      }
    )
    vi.mocked(useDialogService().confirm).mockResolvedValue(true)
    vi.spyOn(api, 'deleteUserData').mockResolvedValue(
      new Response(null, { status: 204 })
    )
    vi.spyOn(api, 'storeUserData').mockImplementation(async () =>
      Response.json({
        id: '78ebcb5b-028d-45e8-9f9c-b20f433c364d',
        modified: 2,
        size: 20
      })
    )
    const saving = service.saveWorkflowAs(retainedDocument, {
      filename: 'copy'
    })
    await entered
    scope.value = { ...originalScope, workspaceId: 'workspace-b' }
    scope.value = originalScope
    release()
    await expect(saving).resolves.toBe(false)
    expect(api.deleteUserData).not.toHaveBeenCalled()
    expect(api.storeUserData).not.toHaveBeenCalled()
    expect(toRaw(useWorkflowStore().getWorkflowByPath(destination.path))).toBe(
      toRaw(destination)
    )
    expect(useWorkflowStore().isOpen(destination)).toBe(true)
    expect(drafts.getDraft(destination.path)).toEqual(before)
    expect(useTelemetry()?.trackWorkflowSaved).not.toHaveBeenCalled()
  })

  it.for(['workspace', 'owner', 'leave-return'] as const)(
    'cancels UI Save As clone graph loading after %s scope revocation',
    async (change) => {
      const { service, retainedDocument, graph } =
        await prepareRetainedHandoff()
      const originalScope = { ownerId: 'user-a', workspaceId: 'workspace-a' }
      const scope = ref(originalScope)
      registerUserFileScopeProvider(() => scope.value)
      retainedDocument.savedFileIdentity = {
        ...originalScope,
        id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
      }
      const drafts = useWorkflowDraftStoreV2()
      drafts.removeDraft(retainedDocument.path)
      retainedDocument.changeTracker.activeState = zComfyWorkflow.parse(
        graph.serialize()
      )
      drafts.saveDraft(
        retainedDocument.path,
        JSON.stringify(retainedDocument.activeState),
        {
          name: retainedDocument.key,
          isTemporary: false,
          savedFileIdentity: retainedDocument.savedFileIdentity
        }
      )
      const sourceDraft = drafts.getDraft(retainedDocument.path)
      let enter = () => {}
      const entered = new Promise<void>((resolve) => {
        enter = resolve
      })
      let release = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      mockExtensionService.invokeExtensionsAsync.mockImplementation(
        async (hook) => {
          if (hook === 'afterConfigureGraph') {
            enter()
            await gate
          }
          return []
        }
      )
      vi.spyOn(api, 'storeUserData').mockImplementation(async () =>
        Response.json({
          id: '78ebcb5b-028d-45e8-9f9c-b20f433c364d',
          modified: 2,
          size: 20
        })
      )
      const saving = service.saveWorkflowAs(retainedDocument, {
        filename: 'copy'
      })
      await entered
      scope.value =
        change === 'owner'
          ? { ...originalScope, ownerId: 'user-b' }
          : { ...originalScope, workspaceId: 'workspace-b' }
      if (change === 'leave-return') scope.value = originalScope
      release()
      await expect(saving).resolves.toBe(false)
      expect(api.storeUserData).not.toHaveBeenCalled()
      expect(useWorkflowStore().activeWorkflow?.path).not.toBe(
        'workflows/copy.json'
      )
      expect(
        useWorkflowStore().getWorkflowByPath('workflows/copy.json')
      ).toBeNull()
      expect(retainedDocument.savedFileIdentity).toMatchObject(originalScope)
      expect(drafts.getDraft(retainedDocument.path)?.data).toBe(
        sourceDraft?.data
      )
      expect(retainedDocument.isModified).toBe(true)
      expect(useTelemetry()?.trackWorkflowSaved).not.toHaveBeenCalled()
    }
  )

  it.for(['create', 'delete'] as const)(
    'aborts Save As before actual %s send when scope changes during HTTP authentication preparation',
    async (operation) => {
      const { service, retainedDocument } = await prepareRetainedHandoff()
      const originalScope = { ownerId: 'user-a', workspaceId: 'workspace-a' }
      const scope = ref(originalScope)
      registerUserFileScopeProvider(() => scope.value)
      retainedDocument.savedFileIdentity = {
        ...originalScope,
        id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
      }
      const drafts = useWorkflowDraftStoreV2()
      drafts.removeDraft(retainedDocument.path)
      let destination: ComfyWorkflow | undefined
      if (operation === 'delete') {
        destination = new ComfyWorkflow({
          path: 'workflows/copy.json',
          modified: 1,
          size: 20
        })
        useWorkflowStore().attachWorkflow(destination)
        vi.mocked(useDialogService().confirm).mockResolvedValue(true)
      }
      let enter = () => {}
      const entered = new Promise<void>((resolve) => {
        enter = resolve
      })
      let release = () => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      let sends = 0
      if (operation === 'create') {
        vi.spyOn(api, 'storeUserData').mockImplementation(
          async (_path, _data, options) => {
            enter()
            await gate
            options?.signal?.throwIfAborted()
            sends++
            return Response.json({
              id: '78ebcb5b-028d-45e8-9f9c-b20f433c364d',
              modified: 2,
              size: 20
            })
          }
        )
      } else {
        vi.spyOn(api, 'deleteUserData').mockImplementation(
          async (_path, options) => {
            enter()
            await gate
            options?.signal?.throwIfAborted()
            sends++
            return new Response(null, { status: 204 })
          }
        )
      }
      const saving = service.saveWorkflowAs(retainedDocument, {
        filename: 'copy'
      })
      await entered
      scope.value = { ownerId: 'user-b', workspaceId: 'workspace-b' }
      release()
      await expect(saving).resolves.toBe(false)
      expect(sends).toBe(0)
      if (destination)
        expect(
          toRaw(useWorkflowStore().getWorkflowByPath(destination.path))
        ).toBe(toRaw(destination))
      else
        expect(
          useWorkflowStore().getWorkflowByPath('workflows/copy.json')
        ).toBeNull()
      expect(useTelemetry()?.trackWorkflowSaved).not.toHaveBeenCalled()
    }
  )

  it('UI Save As keeps a valid source identity and receives a fresh identity for the saved copy', async () => {
    const { service, retainedDocument } = await prepareRetainedHandoff()
    const scope = { ownerId: 'user-a', workspaceId: 'workspace-a' }
    registerUserFileScopeProvider(() => scope)
    const identity = { ...scope, id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b' }
    retainedDocument.savedFileIdentity = identity
    useWorkflowDraftStoreV2().removeDraft(retainedDocument.path)
    const copyId = '78ebcb5b-028d-45e8-9f9c-b20f433c364d'
    vi.spyOn(api, 'storeUserData').mockImplementation(async () =>
      Response.json({ id: copyId, modified: 2, size: 20 })
    )
    expect(
      await service.saveWorkflowAs(retainedDocument, { filename: 'copy' })
    ).toBe(true)
    expect(retainedDocument.savedFileIdentity).toEqual(identity)
    expect(useWorkflowStore().activeWorkflow?.savedFileIdentity).toEqual({
      ...scope,
      id: copyId
    })
    expect(api.storeUserData).toHaveBeenCalledExactlyOnceWith(
      'workflows/copy.json',
      expect.any(String),
      {
        overwrite: false,
        throwOnError: true,
        full_info: true,
        signal: expect.any(AbortSignal)
      }
    )
    expect(useTelemetry()?.trackWorkflowSaved).toHaveBeenCalledExactlyOnceWith({
      is_app: false,
      is_new: true
    })
  })

  it.for([undefined, '78ebcb5b-028d-45e8-9f9c-b20f433c364d'])(
    'settles real tab bootstrap after draft identity %s refuses and then opens a valid unrelated saved-file URL',
    async (draftId) => {
      useAuthStore().currentUser = fromPartial<User>({ uid: 'user-a' })
      useAuthStore().isInitialized = true
      const workspace = {
        id: 'workspace-a',
        name: 'Workspace A',
        type: 'team' as const,
        role: 'owner' as const,
        created_at: '2026-10-30T00:00:00Z',
        joined_at: '2026-10-30T00:00:00Z',
        members: [],
        membersLoaded: false,
        pendingInvites: [],
        pendingInvitesLoaded: false
      }
      Object.assign(useTeamWorkspaceStore(), {
        workspaces: [workspace],
        activeWorkspaceId: workspace.id,
        initState: 'ready'
      })
      const { persistence, savedFileLoader, router, retainedDocument } =
        await prepareRetainedHandoff({
          withUrlLoader: true,
          restoreTabs: false
        })
      assert.exists(savedFileLoader)
      const path = 'workflows/legacy-collision.json'
      const incomingId = 'd1358d40-fc80-4577-9b3a-265d8b8600dd'
      const scope = { ownerId: 'user-a', workspaceId: workspace.id }
      const drafts = useWorkflowDraftStoreV2()
      drafts.saveDraft(path, JSON.stringify(createWorkflowGraphData()), {
        name: 'legacy-collision.json',
        isTemporary: false,
        ...(draftId && { savedFileIdentity: { ...scope, id: draftId } })
      })
      const before = drafts.getDraft(path)
      vi.mocked(useWorkflowStore().loadWorkflows).mockRestore()
      vi.spyOn(api, 'listUserDataFullInfo').mockResolvedValue([
        {
          id: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
          path: 'legacy-collision.json',
          modified: 1,
          size: 20
        }
      ])
      const incoming = {
        ...createWorkflowGraphData(),
        extra: { marker: 'valid unrelated saved file' }
      }
      vi.spyOn(api, 'fetchApi').mockResolvedValue(
        Response.json({
          id: incomingId,
          path: 'workflows/valid-incoming.json',
          modified: 1,
          size: 20,
          content: JSON.stringify(incoming)
        })
      )
      await router.push(`/?savedFile=${incomingId}`)
      sessionStorage.setItem(
        StorageKeys.openPaths('handoff-client'),
        JSON.stringify({
          workspaceId: 'personal',
          paths: [path],
          activeIndex: 0
        })
      )
      expect(await persistence.initializeWorkflow()).toBe('restored')
      await expect(
        persistence.restoreWorkflowTabsState()
      ).resolves.toBeUndefined()
      expect(drafts.getDraft(path)).toEqual(before)
      expect(toRaw(useWorkflowStore().activeWorkflow)).toBe(
        toRaw(retainedDocument)
      )
      expect(useWorkflowStore().tabsRestored).toBe(true)
      expect(singletonApp.rootGraph.extra.marker).toBe(
        'dirty retained document'
      )
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType: 'workflow_load_failure' })
      )
      expect(await savedFileLoader.openSavedWorkflowFromUrl()).toBe('loaded')
      expect(useWorkflowStore().activeWorkflow?.path).toBe(
        'workflows/valid-incoming.json'
      )
      expect(singletonApp.rootGraph.extra.marker).toBe(
        'valid unrelated saved file'
      )
      expect(drafts.getDraft(path)).toEqual(before)
    }
  )

  it('tab restore propagates an unrelated invalid-state error instead of treating it as an identity refusal', async () => {
    const { persistence } = await prepareRetainedHandoff({ restoreTabs: false })
    const faulty = new ComfyWorkflow({
      path: 'workflows/faulty.json',
      modified: 1,
      size: 10
    })
    useWorkflowStore().attachWorkflow(faulty)
    sessionStorage.setItem(
      StorageKeys.openPaths('handoff-client'),
      JSON.stringify({
        workspaceId: 'personal',
        paths: [faulty.path],
        activeIndex: 0
      })
    )
    const error = new DOMException(
      'Unrelated invalid state',
      'InvalidStateError'
    )
    vi.spyOn(faulty, 'load').mockRejectedValue(error)
    await expect(persistence.restoreWorkflowTabsState()).rejects.toBe(error)
    expect(useWorkflowStore().tabsRestored).toBe(true)
  })

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
