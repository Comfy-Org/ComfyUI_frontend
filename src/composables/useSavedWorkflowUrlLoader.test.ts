import type {
  GetWorkflowContentResponse,
  GetWorkflowResponse
} from '@comfyorg/ingest-types'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, createApp, defineComponent, nextTick, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import '@/scripts/changeTracker'

import { useSavedWorkflowUrlLoader as createLoader } from './useSavedWorkflowUrlLoader'

vi.mock(import('vue-router'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

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
const metadata: GetWorkflowResponse = {
  id: workflowId,
  name: 'My private workflow',
  created_at: '2026-10-24T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
  created_by: 'user-1',
  latest_version: 1
}
const content: GetWorkflowContentResponse = {
  id: 'version-1',
  version: 1,
  created_at: '2026-10-24T00:00:00Z',
  created_by: 'user-1',
  workflow_json: graph
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
  onTestFinished(() => app.unmount())
  if (!loader) throw new Error('Saved workflow loader not initialized')
  return loader
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
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
    vi.mocked(api.fetchApi).mockImplementation(async (url) =>
      Response.json(url.endsWith('/content') ? content : metadata)
    )
    vi.mocked(api.getUserData).mockImplementation(async () =>
      Response.json(graph)
    )
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
      { path: 'My private workflow.json', modified: 1, size: 1 }
    ])
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (workflow) => {
        await useWorkflowStore().openWorkflow(workflow)
        return true
      }
    )
    Object.assign(useRoute().query, { workflow: workflowId, workspace: 'ws-1' })
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
    expect(useRoute().query.workflow).toBe(workflowId)
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
    expect(api.fetchApi).toHaveBeenCalledTimes(2)
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(
      useWorkflowStore().openWorkflows.map((workflow) => workflow.path)
    ).toEqual([path])
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
  })

  it('keeps the unsaved canvas active when the record and sidebar file disagree', async () => {
    const store = useWorkflowStore()
    const unsaved = store.createTemporary('Unsaved.json', graph)
    await store.openWorkflow(unsaved)
    const retained = store.activeWorkflow
    unsaved.isModified = true
    vi.mocked(api.getUserData).mockResolvedValue(
      Response.json({ ...graph, extra: { different: true } })
    )

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
    Object.assign(useRoute().query, { workflow: '../private.json' })

    expect(await useSavedWorkflowUrlLoader().openSavedWorkflowFromUrl()).toBe(
      'failed'
    )
    expect(api.fetchApi).not.toHaveBeenCalled()
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })
})
