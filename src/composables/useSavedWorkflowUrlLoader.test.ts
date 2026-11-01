import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, createApp, defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { api } from '@/scripts/api'
import '@/scripts/changeTracker'

import { useSavedWorkflowUrlLoader as createLoader } from './useSavedWorkflowUrlLoader'

vi.mock(import('vue-router'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))

const workflowId = 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
const path = 'workflows/My private workflow.json'
const graph = {
  id: '2ba0b800-9ff6-4df1-9301-a2ad6930471c',
  version: 0.4,
  nodes: [],
  links: [],
  last_node_id: 0,
  last_link_id: 0
}
const metadata = {
  id: workflowId,
  path,
  content: JSON.stringify(graph),
  modified: 1,
  size: 1
}

function useSavedWorkflowUrlLoader() {
  let loader: ReturnType<typeof createLoader> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        loader = createLoader()
        return () => null
      }
    })
  )
  app.use(i18n)
  app.mount(document.createElement('div'))
  let unmount = () => app.unmount()
  function dispose() {
    unmount()
    unmount = () => {}
  }
  onTestFinished(dispose)
  if (!loader) throw new Error('Saved workflow loader not initialized')
  return { ...loader, dispose }
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function preserveLink(query: {
  savedFile: string
  workspace?: string
  deployment?: string
  environment?: string
}) {
  delete useRoute().query.savedFile
  delete useRoute().query.workspace
  capturePreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW, query, [
    'savedFile',
    'workspace',
    'deployment',
    'environment'
  ])
}

async function loadLateDeployment() {
  vi.mocked(workspaceApi.listDeployments).mockResolvedValue({
    builds_visible: true,
    picked_deployment_id: 'dep-late',
    pick_source: 'browser',
    items: [
      {
        deployment_id: 'dep-late',
        release_id: 'release-late',
        build_id: 'build-late',
        build_name: 'Late deployment',
        release_version: 1,
        status: 'ready',
        can_start: false,
        created_at: '2026-10-24T00:00:00Z'
      }
    ]
  })
  await useDeploymentPickStore().load()
}

describe('private saved workflow navigation', () => {
  beforeEach(() => {
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW)
    useCurrentUser().isLoggedIn = computed(() => true)
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'user-1' }))
    Object.assign(useTeamWorkspaceStore(), {
      initState: 'ready',
      activeWorkspace: {
        id: 'ws-1',
        name: 'Home',
        type: 'personal',
        role: 'owner',
        created_at: '2026-01-01T00:00:00Z',
        joined_at: '2026-01-01T00:00:00Z'
      }
    })
    useDeploymentPickStore().bootOnComfyCloud()
    vi.mocked(api.fetchApi).mockImplementation(async () =>
      Response.json(metadata)
    )
    vi.mocked(api.getUserData).mockImplementation(async () =>
      Response.json(graph)
    )
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
      { path: 'My private workflow.json', id: workflowId, modified: 1, size: 1 }
    ])
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (workflow) => {
        await useWorkflowStore().openWorkflow(workflow)
        return true
      }
    )
    Object.assign(useRoute().query, {
      savedFile: workflowId,
      workspace: 'ws-1'
    })
  })

  it('opens the existing saved document and preserves an unsaved tab', async () => {
    const store = useWorkflowStore()
    const unsaved = store.createTemporary('Unsaved.json', {
      ...graph,
      extra: { privateNote: 'keep me' }
    })
    await store.openWorkflow(unsaved)
    unsaved.isModified = true

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'loaded'
    )

    expect(store.activeWorkflow?.path).toBe(path)
    expect(store.activeWorkflow?.isTemporary).toBe(false)
    expect(store.openWorkflows.map((workflow) => workflow.path)).toEqual([
      unsaved.path,
      path
    ])
    expect(unsaved.activeState?.extra?.privateNote).toBe('keep me')
    expect(unsaved.isModified).toBe(true)
    expect(api.storeUserData).not.toHaveBeenCalled()
  })

  it('retains edits when the linked saved workflow is already open', async () => {
    const store = useWorkflowStore()
    useSavedWorkflowUrlLoader()
    await store.loadWorkflows()
    const saved = store.getWorkflowByPath(path)
    if (!saved) throw new Error('saved fixture missing')
    const loaded = await store.openWorkflow(saved)
    loaded.changeTracker.activeState = { ...graph, extra: { unsaved: 'keep' } }
    loaded.isModified = true

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'loaded'
    )

    expect(store.activeWorkflow).toBe(loaded)
    expect(store.activeWorkflow?.activeState.extra?.unsaved).toBe('keep')
    expect(store.openWorkflows.map((workflow) => workflow.path)).toEqual([path])
  })

  it('waits for sign-in without sending a private read or consuming the link', async () => {
    useCurrentUser().isLoggedIn = computed(() => false)

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'deferred'
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useRoute().query.savedFile).toBe(workflowId)
  })

  it('resumes a deferred link once auth and workspace readiness settle', async () => {
    const loggedIn = ref(false)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    useCurrentUser().resolvedUserInfo = computed(() =>
      loggedIn.value ? { id: 'user-1' } : null
    )
    useTeamWorkspaceStore().initState = 'loading'
    const loader = useSavedWorkflowUrlLoader()

    expect(await loader.openSavedWorkflowFromUrl()).toBe('deferred')
    loggedIn.value = true
    await nextTick()
    expect(api.fetchApi).not.toHaveBeenCalled()
    useTeamWorkspaceStore().initState = 'ready'

    await vi.waitFor(() =>
      expect(useWorkflowStore().activeWorkflow?.path).toBe(path)
    )
    useTeamWorkspaceStore().initState = 'loading'
    useTeamWorkspaceStore().initState = 'ready'
    await nextTick()
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      `/userdata-files/${workflowId}`,
      { signal: expect.any(AbortSignal) }
    )
  })

  it('coalesces readiness changes while its deferred attempt is settling', async () => {
    const loggedIn = ref(false)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    const loader = useSavedWorkflowUrlLoader()
    const pending = loader.openSavedWorkflowFromUrl()
    loggedIn.value = true

    expect(await pending).toBe('deferred')
    await vi.waitFor(() =>
      expect(useWorkflowStore().activeWorkflow?.path).toBe(path)
    )
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      `/userdata-files/${workflowId}`,
      { signal: expect.any(AbortSignal) }
    )
  })

  it('does not start early when readiness settles before its startup step', async () => {
    const loggedIn = ref(false)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    const loader = useSavedWorkflowUrlLoader()
    loggedIn.value = true
    await nextTick()
    expect(api.fetchApi).not.toHaveBeenCalled()

    expect(await loader.openSavedWorkflowFromUrl()).toBe('loaded')
  })

  it('does not resume a deferred link after scope disposal', async () => {
    const loggedIn = ref(false)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    const loader = useSavedWorkflowUrlLoader()
    expect(await loader.openSavedWorkflowFromUrl()).toBe('deferred')
    loader.dispose()
    loggedIn.value = true
    await nextTick()

    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('refuses a startup continuation after its scope was disposed', async () => {
    const loader = useSavedWorkflowUrlLoader()
    loader.dispose()

    expect(await loader.openSavedWorkflowFromUrl()).toBe('failed')
    expect(api.fetchApi).not.toHaveBeenCalled()
  })

  it('does not open in another workspace after a refused workspace switch', async () => {
    Object.assign(useRoute().query, { workspace: 'ws-2' })

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useWorkflowStore().openWorkflows).toEqual([])
    expect(useToast().toasts.at(-1)?.title).toBe(
      'Could not open this saved workflow in the requested environment. Try the link again after selecting that workspace and environment.'
    )
  })

  it('does not open against standard Cloud after a custom deployment selection was refused', async () => {
    Object.assign(useRoute().query, { deployment: 'dep-missing' })

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useWorkflowStore().openWorkflows).toEqual([])
  })

  it('does not apply a late private response after sign-out', async () => {
    const loggedIn = ref(true)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    const response = deferredResponse()
    vi.mocked(api.fetchApi).mockReturnValueOnce(response.promise)
    const pending = useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()
    await nextTick()
    loggedIn.value = false
    response.resolve(Response.json(metadata))

    expect(await pending).toBe('failed')
    expect(api.fetchApi).toHaveBeenCalledTimes(1)
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(useWorkflowStore().openWorkflows).toEqual([])
  })

  it('does not apply private content after the active workspace changes mid-read', async () => {
    const response = deferredResponse()
    vi.mocked(api.fetchApi).mockReturnValueOnce(response.promise)
    const pending = useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()
    await nextTick()
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspace: {
        ...useTeamWorkspaceStore().activeWorkspace,
        id: 'ws-other'
      }
    })
    response.resolve(Response.json(metadata))

    expect(await pending).toBe('failed')
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it('coalesces duplicate startup requests into one normal document open', async () => {
    const loader = useSavedWorkflowUrlLoader()
    const first = loader.openSavedWorkflowFromUrl()
    const second = loader.openSavedWorkflowFromUrl()

    expect(first).toBe(second)
    expect(await first).toBe('loaded')
    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      `/userdata-files/${workflowId}`,
      { signal: expect.any(AbortSignal) }
    )
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(
      useWorkflowStore().openWorkflows.map((workflow) => workflow.path)
    ).toEqual([path])
  })

  it.for([
    { label: 'workspace', target: { workspace: 'ws-2' } },
    {
      label: 'standard environment',
      target: { workspace: 'ws-1', environment: 'standard' }
    },
    {
      label: 'custom environment',
      target: { workspace: 'ws-1', deployment: 'dep-next' }
    }
  ])(
    'does not apply or consume the same workflow with a replacement $label target',
    async ({ target }) => {
      preserveLink({ savedFile: workflowId, workspace: 'ws-1' })
      const response = deferredResponse()
      vi.mocked(api.fetchApi).mockReturnValueOnce(response.promise)
      const pending = useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()
      await nextTick()
      preserveLink({ savedFile: workflowId, ...target })
      response.resolve(Response.json(metadata))

      expect(await pending).toBe('failed')
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(
        getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'workspace')
      ).toBe(target.workspace)
      expect(
        getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
      ).toBe(workflowId)
    }
  )

  it('preserves a plain link when a late listing requires a deployment reload', async () => {
    preserveLink({ savedFile: workflowId, workspace: 'ws-1' })
    const response = deferredResponse()
    vi.mocked(api.fetchApi).mockReturnValueOnce(response.promise)
    const pending = useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()
    await nextTick()
    await loadLateDeployment()
    expect(useDeploymentPickStore().changeSinceBoot).toBe('deployment')
    response.resolve(Response.json(metadata))

    expect(await pending).toBe('failed')
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
    ).toBe(workflowId)
  })

  it('keeps a plain link for reload when the late listing arrived before its startup step', async () => {
    preserveLink({ savedFile: workflowId, workspace: 'ws-1' })
    await loadLateDeployment()

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
    ).toBe(workflowId)
  })

  it.for([
    {
      label: 'sign-out',
      change: (loggedIn: Ref<boolean>) => {
        loggedIn.value = false
      }
    },
    {
      label: 'workspace change',
      change: (_loggedIn: Ref<boolean>) => {
        Object.assign(useTeamWorkspaceStore(), {
          activeWorkspace: {
            ...useTeamWorkspaceStore().activeWorkspace,
            id: 'ws-other'
          }
        })
      }
    }
  ])(
    'clears the old replay intent after $label despite a late deployment listing',
    async ({ change }) => {
      const loggedIn = ref(true)
      useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
      preserveLink({ savedFile: workflowId, workspace: 'ws-1' })
      const response = deferredResponse()
      vi.mocked(api.fetchApi).mockReturnValueOnce(response.promise)
      const pending = useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()
      await nextTick()
      await loadLateDeployment()
      change(loggedIn)
      response.resolve(Response.json(metadata))

      expect(await pending).toBe('failed')
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(
        getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
      ).toBeUndefined()
    }
  )

  it('does not replay a standard-environment link onto a late custom deployment', async () => {
    preserveLink({
      savedFile: workflowId,
      workspace: 'ws-1',
      environment: 'standard'
    })
    const response = deferredResponse()
    vi.mocked(api.fetchApi).mockReturnValueOnce(response.promise)
    const pending = useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()
    await nextTick()
    await loadLateDeployment()
    response.resolve(Response.json(metadata))

    expect(await pending).toBe('failed')
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
    ).toBeUndefined()
  })

  it('keeps cancellation final when identity leaves and returns during graph preparation', async () => {
    const loggedIn = ref(true)
    useCurrentUser().isLoggedIn = computed(() => loggedIn.value)
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (_workflow, options) => {
        loggedIn.value = false
        loggedIn.value = true
        return options?.isCurrent?.() ?? true
      }
    )

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )
    expect(useWorkflowStore().openWorkflows).toEqual([])
    expect(useToast().toasts).toEqual([])
  })

  it('reports a failed open while its link context remains current', async () => {
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(false)

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        title:
          'This saved workflow is unavailable. Check that you are signed in to the right workspace and have access.'
      })
    )
  })

  it('keeps the unsaved canvas active when a loaded unknown-ID path collides', async () => {
    const store = useWorkflowStore()
    const unsaved = store.createTemporary('Unsaved.json', graph)
    await store.openWorkflow(unsaved)
    const retained = store.activeWorkflow
    unsaved.isModified = true
    const collision = store.createTemporary('My private workflow.json', graph)
    await collision.load()
    collision.size = 1

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )

    expect(store.activeWorkflow).toBe(retained)
    expect(unsaved.isModified).toBe(true)
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it.for([401, 403, 404])(
    'keeps the canvas when private content is unavailable (%s)',
    async (status) => {
      vi.mocked(api.fetchApi).mockResolvedValue(new Response(null, { status }))

      expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
        'failed'
      )
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(useToast().toasts.at(-1)?.title).toBe(
        'This saved workflow is unavailable. Check that you are signed in to the right workspace and have access.'
      )
    }
  )

  it('rejects a bad URL without fetching or opening a document', async () => {
    Object.assign(useRoute().query, { savedFile: '../private.json' })

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })
})
