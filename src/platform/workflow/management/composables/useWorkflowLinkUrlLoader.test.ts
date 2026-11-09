import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { effectScope } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { blankGraph } from '@/scripts/defaultGraph'
import '@/scripts/changeTracker'

import { useWorkflowLinkUrlLoader } from './useWorkflowLinkUrlLoader'

vi.mock(import('vue-router'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const ID = '82b98188-0c8f-41d2-9b91-617b9152b809'
const NAMESPACE = PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID
const PATH = 'workflows/Car swap.json'
const MODIFIED_MS = 1_793_000_000_000

function serveFile(path = PATH) {
  vi.spyOn(api, 'fetchApi').mockResolvedValue(
    Response.json({ path, size: 12, modified: MODIFIED_MS })
  )
  vi.spyOn(api, 'getUserData').mockImplementation(async () =>
    Response.json(blankGraph)
  )
  vi.spyOn(api, 'listUserDataFullInfo').mockResolvedValue([
    { path: path.slice('workflows/'.length), size: 12, modified: MODIFIED_MS }
  ])
}

function refuse(status: number, body: object) {
  vi.spyOn(api, 'fetchApi').mockResolvedValue(Response.json(body, { status }))
}

async function openExistingTab() {
  const store = useWorkflowStore()
  const existing = store.createTemporary('Existing.json')
  await store.openWorkflow(existing)
  return { store, existing, active: store.activeWorkflow }
}

describe('workflow-id links', () => {
  let loader: ReturnType<typeof useWorkflowLinkUrlLoader>
  beforeEach(() => {
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const scopedLoader = scope.run(useWorkflowLinkUrlLoader)
    assert.exists(scopedLoader)
    loader = scopedLoader
    distribution.isCloud = true
    clearPreservedQuery(NAMESPACE)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
    vi.mocked(useRouter().replace).mockImplementation(async (to) => {
      const query = useRoute().query
      Object.keys(query).forEach((key) => {
        delete query[key]
      })
      if (typeof to === 'object' && 'query' in to)
        Object.assign(query, to.query)
    })
  })

  it('opens the sidebar file the workflow id names, in front of restored tabs', async () => {
    serveFile()
    Object.assign(useRoute().query, {
      workflowId: ID,
      workflows: 'other',
      keep: 'yes'
    })
    const { store, existing } = await openExistingTab()
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (workflow) => {
        await store.openWorkflow(workflow)
        return true
      }
    )

    expect(await loader.openWorkflowLinkFromUrl()).toBe('opened')

    expect(api.fetchApi).toHaveBeenCalledExactlyOnceWith(
      `/workflows/${ID}/sidebar-file`
    )
    expect(store.activeWorkflow?.path).toBe(PATH)
    expect(store.activeWorkflow?.isTemporary).toBe(false)
    expect(store.openWorkflows.map(({ path }) => path)).toEqual([
      existing.path,
      PATH
    ])
    expect(useRoute().query).toEqual({ keep: 'yes' })
    expect(
      useTelemetry()?.trackWorkflowLinkOpened
    ).toHaveBeenCalledExactlyOnceWith({
      outcome: 'opened',
      workspace_id: 'workspace-1'
    })
    expect(await loader.openWorkflowLinkFromUrl()).toBe('absent')
    expect(useTelemetry()?.trackWorkflowLinkOpened).toHaveBeenCalledTimes(1)
  })

  it('opens a link preserved through sign-in and onboarding and clears the stash', async () => {
    serveFile()
    sessionStorage.setItem(
      'Comfy.PreservedQuery.workflowId',
      JSON.stringify({ workflowId: ID })
    )
    capturePreservedQuery(
      PRESERVED_QUERY_NAMESPACES.WORKFLOWS,
      { workflows: 'ignored' },
      ['workflows']
    )

    expect(await loader.openWorkflowLinkFromUrl()).toBe('opened')

    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBeUndefined()
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOWS, 'workflows')
    ).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.PreservedQuery.workflowId')).toBeNull()
  })

  it('opens a sidebar file saved after the bootstrap listing was cached', async () => {
    serveFile()
    vi.mocked(api.listUserDataFullInfo).mockResolvedValueOnce([
      { path: 'old.json', size: 12, modified: MODIFIED_MS }
    ])
    const store = useWorkflowStore()
    await store.loadWorkflows()
    Object.assign(useRoute().query, { workflowId: ID })
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (workflow) => {
        await store.openWorkflow(workflow)
        return true
      }
    )

    expect(await loader.openWorkflowLinkFromUrl()).toBe('opened')
    expect(store.activeWorkflow?.path).toBe(PATH)
    expect(useToast().toasts).toEqual([])
  })

  it('reports one result across boot consumers when URL cleanup fails', async () => {
    serveFile()
    Object.assign(useRoute().query, { workflowId: ID })
    vi.mocked(useRouter().replace).mockRejectedValueOnce(new Error('cancelled'))
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
    const scope = effectScope()
    try {
      const consumers = scope.run(() => [
        useWorkflowLinkUrlLoader(),
        useWorkflowLinkUrlLoader()
      ])
      assert.exists(consumers)

      expect(await consumers[0].openWorkflowLinkFromUrl()).toBe('opened')
      await consumers[1].openWorkflowLinkFromUrl(true)

      expect(api.fetchApi).toHaveBeenCalledTimes(1)
      expect(useTelemetry()?.trackWorkflowLinkOpened).toHaveBeenCalledTimes(1)
      expect(useRoute().query).toEqual({})
    } finally {
      scope.stop()
    }
  })

  it('opens nothing and leaves restored tabs on 404', async () => {
    refuse(404, { code: 'NOT_FOUND', message: 'not found' })
    Object.assign(useRoute().query, { workflowId: ID })
    const { store, existing, active } = await openExistingTab()

    expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

    expect(store.activeWorkflow).toBe(active)
    expect(store.openWorkflows).toEqual([existing])
    expect(useToast().toasts.map(({ title }) => title)).toEqual([
      "Couldn't open this workflow"
    ])
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(useRoute().query).toEqual({})
    expect(
      useTelemetry()?.trackWorkflowLinkOpened
    ).toHaveBeenCalledExactlyOnceWith({
      outcome: 'not_found',
      workspace_id: 'workspace-1'
    })
  })

  it.for([
    {
      name: 'no sidebar path in details',
      body: { details: { reason: 'no_sidebar_path' } },
      reason: 'no_sidebar_path'
    },
    {
      name: 'an ambiguous name in details',
      body: { details: { reason: 'name_ambiguous' } },
      reason: 'name_ambiguous'
    },
    {
      name: 'a missing file in details',
      body: { details: { reason: 'file_missing' } },
      reason: 'file_missing'
    },
    {
      name: 'mismatched content in details',
      body: { details: { reason: 'content_mismatch' } },
      reason: 'content_mismatch'
    },
    {
      name: 'a reason outside details',
      body: { reason: 'content_mismatch' },
      reason: 'unknown'
    },
    {
      name: 'a reason this release does not know',
      body: { details: { reason: 'Car swap.json renamed' } },
      reason: 'unknown'
    },
    {
      name: 'no reason',
      body: {},
      reason: 'unknown'
    }
  ] as const)(
    'refuses an out-of-sync workflow with $name and opens nothing',
    async ({ body, reason }) => {
      refuse(409, {
        code: 'WORKFLOW_OUT_OF_SYNC',
        message: 'workflows/Car swap.json is out of sync',
        ...body
      })
      Object.assign(useRoute().query, { workflowId: ID, workflows: 'Car swap' })
      const { store, existing, active } = await openExistingTab()
      const contentRead = vi.spyOn(api, 'getUserData')

      expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

      expect(api.fetchApi).toHaveBeenCalledTimes(1)
      expect(contentRead).not.toHaveBeenCalled()
      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(store.activeWorkflow).toBe(active)
      expect(store.openWorkflows).toEqual([existing])
      expect(useToast().toasts.map(({ title }) => title)).toEqual([
        "Couldn't open this workflow"
      ])
      expect(useRoute().query).toEqual({})
      expect(
        useTelemetry()?.trackWorkflowLinkOpened
      ).toHaveBeenCalledExactlyOnceWith({
        outcome: 'out_of_sync',
        reason,
        workspace_id: 'workspace-1'
      })
    }
  )

  it.for([
    {
      name: 'another code',
      response: () => Response.json({ code: 'CONFLICT' }, { status: 409 })
    },
    {
      name: 'a body that is not JSON',
      response: () => new Response('{', { status: 409 })
    }
  ])(
    'treats a 409 with $name as out of sync for an unknown reason',
    async ({ response }) => {
      vi.spyOn(api, 'fetchApi').mockResolvedValue(response())
      Object.assign(useRoute().query, { workflowId: ID })

      expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

      expect(useToast().toasts[0]?.title).toBe("Couldn't open this workflow")
      expect(
        useTelemetry()?.trackWorkflowLinkOpened
      ).toHaveBeenCalledExactlyOnceWith({
        outcome: 'out_of_sync',
        reason: 'unknown',
        workspace_id: 'workspace-1'
      })
    }
  )

  it.for(['invalid', '', null, [ID, ID]])(
    'rejects malformed workflowId %j without a request',
    async (workflowId) => {
      const request = vi.spyOn(api, 'fetchApi')
      Object.assign(useRoute().query, { workflowId })

      expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

      expect(request).not.toHaveBeenCalled()
      expect(useToast().toasts[0]?.title).toBe("Couldn't open this workflow")
      expect(useRoute().query).toEqual({})
    }
  )

  it.for(['workspace', 'deployment'])(
    'keeps a stashed link until the %s navigation finishes',
    async (namespace) => {
      const request = vi.spyOn(api, 'fetchApi')
      capturePreservedQuery(NAMESPACE, { workflowId: ID }, ['workflowId'])
      capturePreservedQuery(namespace, { [namespace]: 'destination' }, [
        namespace
      ])

      expect(await loader.openWorkflowLinkFromUrl()).toBe('pending')

      expect(request).not.toHaveBeenCalled()
      expect(useToast().toasts).toEqual([])
      expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
      expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(ID)
      clearPreservedQuery(namespace)
      serveFile()

      expect(await loader.openWorkflowLinkFromUrl(true)).toBe('opened')
      expect(useTelemetry()?.trackWorkflowLinkOpened).toHaveBeenCalledTimes(1)
    }
  )

  it('does nothing outside Cloud', async () => {
    distribution.isCloud = false
    const request = vi.spyOn(api, 'fetchApi')
    Object.assign(useRoute().query, { workflowId: ID })

    expect(await loader.openWorkflowLinkFromUrl()).toBe('absent')

    expect(request).not.toHaveBeenCalled()
    expect(useRoute().query).toEqual({ workflowId: ID })
    expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'server error',
      response: () => new Response(null, { status: 500 })
    },
    { name: 'invalid JSON', response: () => new Response('{') },
    {
      name: 'a reply without a path',
      response: () => Response.json({ size: 1, modified: MODIFIED_MS })
    },
    {
      name: 'a path outside the workflows folder',
      response: () =>
        Response.json({
          path: 'comfy.settings.json',
          size: 1,
          modified: MODIFIED_MS
        })
    },
    {
      name: 'a path that leaves the workflows folder',
      response: () =>
        Response.json({
          path: 'workflows/../secrets.json',
          size: 1,
          modified: MODIFIED_MS
        })
    }
  ])(
    'reports $name as an opening error rather than a missing workflow',
    async ({ response }) => {
      vi.spyOn(api, 'fetchApi').mockResolvedValue(response())
      Object.assign(useRoute().query, { workflowId: ID })

      expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

      expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
      expect(useToast().toasts[0]?.title).toBe(
        "Couldn't open this workflow. Please try again."
      )
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'error_loading_workflow_link'
        })
      )
      expect(
        useTelemetry()?.trackWorkflowLinkOpened
      ).toHaveBeenCalledExactlyOnceWith({
        outcome: 'error',
        workspace_id: 'workspace-1'
      })
    }
  )

  it('keeps the intent if the workspace changes during the lookup', async () => {
    vi.spyOn(api, 'fetchApi').mockImplementation(async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      return new Response(null, { status: 404 })
    })
    Object.assign(useRoute().query, { workflowId: ID })

    expect(await loader.openWorkflowLinkFromUrl()).toBe('pending')

    expect(useRoute().query.workflowId).toBe(ID)
    expect(useToast().toasts).toEqual([])
    expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
  })

  it('keeps tabs unchanged when the sidebar file cannot be opened', async () => {
    serveFile()
    Object.assign(useRoute().query, { workflowId: ID })
    const { store, existing, active } = await openExistingTab()
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(false)

    expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

    expect(store.activeWorkflow).toBe(active)
    expect(store.openWorkflows).toEqual([existing])
    expect(useToast().toasts[0]?.title).toBe(
      "Couldn't open this workflow. Please try again."
    )
  })
})
