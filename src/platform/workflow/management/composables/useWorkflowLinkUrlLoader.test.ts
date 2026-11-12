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
import { createApp, effectScope } from 'vue'
import type { App, EffectScope } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type {
  LocationQueryRaw,
  RouteLocationNormalized,
  Router
} from 'vue-router'

import { useToast } from '@/components/ui/toast/toastStore'
import { useUrlActionLoaders } from '@/composables/useUrlActionLoaders'
import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_DEFINITIONS } from '@/platform/navigation/preservedQueryDefinitions'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { installPreservedQueryTracker } from '@/platform/navigation/preservedQueryTracker'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useLinkedWorkflowUrlLoader } from '@/platform/workflow/management/composables/useLinkedWorkflowUrlLoader'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { blankGraph } from '@/scripts/defaultGraph'
import '@/scripts/changeTracker'

import { useWorkflowLinkUrlLoader } from './useWorkflowLinkUrlLoader'

vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/platform/workspace/composables/useDeploymentUrlLoader'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUrlLoader'))
vi.mock(import('@/platform/account/composables/useInviteUrlLoader'))
vi.mock(import('@/platform/account/composables/useCreateWorkspaceUrlLoader'))
vi.mock(
  import('@/platform/billing/subscription/composables/usePricingTableUrlLoader')
)
vi.mock(import('@/platform/billing/subscription/composables/useTopUpUrlLoader'))
vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('@/platform/assets/composables/useAssetsUrlLoader'))
vi.mock(import('@/platform/openOnCloud/composables/useLocalHandoffUrlLoader'))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const ID = '82b98188-0c8f-41d2-9b91-617b9152b809'
const NEXT_ID = '5d1c7f0e-3a4b-4c2d-8e9f-0a1b2c3d4e5f'
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

function holdLookup() {
  serveFile()
  let respond: () => void = () => {}
  vi.mocked(api.fetchApi).mockReturnValueOnce(
    new Promise((resolve) => {
      respond = () =>
        resolve(Response.json({ path: PATH, size: 12, modified: MODIFIED_MS }))
    })
  )
  return () => respond()
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

function isUrlCleanup(to: RouteLocationNormalized): boolean {
  return !('workflowId' in to.query)
}

function isNewerLink(to: RouteLocationNormalized): boolean {
  return to.query.workflowId === NEXT_ID
}

describe('workflow-id links', () => {
  let router: Router
  let app: App
  let scope: EffectScope
  let loader: ReturnType<typeof useWorkflowLinkUrlLoader>

  function inApp<T>(composable: () => T): T {
    const result = app.runWithContext(() => scope.run(composable))
    assert.exists(result)
    return result
  }

  function currentQuery() {
    return router.currentRoute.value.query
  }

  async function navigate(query: LocationQueryRaw) {
    await router.push({ path: '/', query })
  }

  function holdNavigation(matches: (to: RouteLocationNormalized) => boolean) {
    let arrive: () => void = () => {}
    let release: () => void = () => {}
    const arrived = new Promise<void>((resolve) => {
      arrive = resolve
    })
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const removeGuard = router.beforeEach(async (to) => {
      if (!matches(to)) return
      arrive()
      await released
    })
    return {
      arrived,
      release: () => {
        removeGuard()
        release()
      }
    }
  }

  function runUrlActions() {
    return inApp(useUrlActionLoaders).runUrlActionLoaders()
  }

  beforeEach(async () => {
    distribution.isCloud = true
    clearPreservedQuery(NAMESPACE)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOWS)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.SETTINGS)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
    })
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)
    app = createApp({})
    app.use(router)
    await router.push('/')
    scope = effectScope()
    onTestFinished(() => scope.stop())
    loader = inApp(useWorkflowLinkUrlLoader)
  })

  it('opens the sidebar file the workflow id names, in front of restored tabs', async () => {
    serveFile()
    await navigate({ workflowId: ID, workflows: 'other', keep: 'yes' })
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
    expect(currentQuery()).toEqual({ keep: 'yes' })
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
    await navigate({ workflowId: ID })
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
    await navigate({ workflowId: ID })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
    const failCleanupOnce = vi
      .fn(() => true)
      .mockImplementationOnce(() => {
        throw new Error('cancelled')
      })
    router.beforeEach(failCleanupOnce)
    const consumers = [
      inApp(useWorkflowLinkUrlLoader),
      inApp(useWorkflowLinkUrlLoader)
    ]

    expect(await consumers[0].openWorkflowLinkFromUrl()).toBe('opened')
    await consumers[1].openWorkflowLinkFromUrl(true)

    expect(api.fetchApi).toHaveBeenCalledTimes(1)
    expect(useTelemetry()?.trackWorkflowLinkOpened).toHaveBeenCalledTimes(1)
    expect(currentQuery()).toEqual({})
  })

  it('opens nothing and leaves restored tabs on 404', async () => {
    refuse(404, { code: 'NOT_FOUND', message: 'not found' })
    await navigate({ workflowId: ID })
    const { store, existing, active } = await openExistingTab()

    expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

    expect(store.activeWorkflow).toBe(active)
    expect(store.openWorkflows).toEqual([existing])
    expect(useToast().toasts.map(({ title }) => title)).toEqual([
      "Couldn't open this workflow"
    ])
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(currentQuery()).toEqual({})
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
      await navigate({ workflowId: ID, workflows: 'Car swap' })
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
      expect(currentQuery()).toEqual({})
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
      await navigate({ workflowId: ID })

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
      await navigate({ workflowId })

      expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

      expect(request).not.toHaveBeenCalled()
      expect(useToast().toasts[0]?.title).toBe("Couldn't open this workflow")
      expect(currentQuery()).toEqual({})
    }
  )

  it('rejects an empty workflowId while an older link is still stashed', async () => {
    const request = vi.spyOn(api, 'fetchApi')
    capturePreservedQuery(NAMESPACE, { workflowId: ID }, ['workflowId'])
    await navigate({ workflowId: '' })

    expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

    expect(request).not.toHaveBeenCalled()
    expect(useToast().toasts[0]?.title).toBe("Couldn't open this workflow")
    expect(currentQuery()).toEqual({})
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBeUndefined()
    expect(loader.hasLinkInFlight()).toBe(false)
  })

  it.for(['workspace', 'deployment'])(
    'keeps a stashed link until the %s navigation finishes',
    async (namespace) => {
      const request = vi.spyOn(api, 'fetchApi')
      await navigate({ workflowId: ID, [namespace]: 'destination' })
      await navigate({})

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
    await navigate({ workflowId: ID })

    expect(await loader.openWorkflowLinkFromUrl()).toBe('absent')

    expect(request).not.toHaveBeenCalled()
    expect(currentQuery()).toEqual({ workflowId: ID })
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
      await navigate({ workflowId: ID })

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

  it.for([
    {
      name: 'the linked file cannot be read',
      fail: () => {
        serveFile('workflows/Customer Jane Doe.json')
        vi.mocked(useWorkflowService().openWorkflow).mockRejectedValue(
          new Error(
            "Failed to load file 'workflows/Customer Jane Doe.json': 500 Internal Server Error"
          )
        )
      },
      reported: new Error('Could not open workflow link'),
      errorType: 'error_opening_workflow_link',
      errorName: 'Error'
    },
    {
      name: 'the lookup reply is not JSON',
      fail: () => {
        vi.spyOn(api, 'fetchApi').mockResolvedValue(
          new Response('workflows/Customer Jane Doe.json')
        )
      },
      reported: new Error('Could not read workflow link'),
      errorType: 'error_loading_workflow_link',
      errorName: 'SyntaxError'
    },
    {
      name: 'custom node code throws an error under its own name',
      fail: () => {
        serveFile()
        const thrown = new Error('Widget size failed')
        thrown.name = 'Customer Jane Doe'
        vi.mocked(useWorkflowService().openWorkflow).mockRejectedValue(thrown)
      },
      reported: new Error('Could not open workflow link'),
      errorType: 'error_opening_workflow_link',
      errorName: 'other'
    },
    {
      name: 'custom node code throws an error whose name changes between reads',
      fail: () => {
        serveFile()
        const thrown = new Error('Widget size failed')
        const names = ['Error', 'Customer Jane Doe']
        Object.defineProperty(thrown, 'name', {
          get: () => names.shift() ?? 'Customer Jane Doe'
        })
        vi.mocked(useWorkflowService().openWorkflow).mockRejectedValue(thrown)
      },
      reported: new Error('Could not open workflow link'),
      errorType: 'error_opening_workflow_link',
      errorName: 'Error'
    },
    {
      name: 'an error name cannot be read',
      fail: () => {
        serveFile()
        const thrown = new Error('Widget size failed')
        Object.defineProperty(thrown, 'name', {
          get: () => {
            throw new Error('Customer Jane Doe')
          }
        })
        vi.mocked(useWorkflowService().openWorkflow).mockRejectedValue(thrown)
      },
      reported: new Error('Could not open workflow link'),
      errorType: 'error_opening_workflow_link',
      errorName: 'other'
    }
  ])(
    'reports that $name without the file name or the error text',
    async ({ fail, reported, errorType, errorName }) => {
      fail()
      await navigate({ workflowId: ID })

      expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

      expect(reportError).toHaveBeenCalledExactlyOnceWith(reported, {
        surface: 'graph',
        errorType,
        context: { error_name: errorName }
      })
      expect(vi.mocked(reportError).mock.calls[0]?.[0]).not.toHaveProperty(
        'cause'
      )
    }
  )

  it('keeps the intent if the workspace changes during the lookup', async () => {
    vi.spyOn(api, 'fetchApi').mockImplementation(async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      return new Response(null, { status: 404 })
    })
    await navigate({ workflowId: ID })

    expect(await loader.openWorkflowLinkFromUrl()).toBe('pending')

    expect(currentQuery().workflowId).toBe(ID)
    expect(useToast().toasts).toEqual([])
    expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
  })

  it('leaves a link the browser navigated to while an earlier lookup waited', async () => {
    const respond = holdLookup()
    await navigate({ workflowId: ID })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)

    const attempt = loader.openWorkflowLinkFromUrl()
    await navigate({ workflowId: NEXT_ID })
    respond()

    expect(await attempt).toBe('pending')
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(currentQuery()).toEqual({ workflowId: NEXT_ID })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(NEXT_ID)
    expect(useToast().toasts).toEqual([])
    expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
  })

  it('opens and clears nothing when the editor unmounts while the lookup waits', async () => {
    const respond = holdLookup()
    await navigate({ workflowId: ID })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)

    const attempt = loader.openWorkflowLinkFromUrl()
    scope.stop()
    respond()

    expect(await attempt).toBe('pending')
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(currentQuery()).toEqual({ workflowId: ID })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(ID)
    expect(useToast().toasts).toEqual([])
    expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'finished navigating to a newer link',
      newer: { workflowId: NEXT_ID },
      route: NEXT_ID,
      stash: NEXT_ID
    },
    {
      name: 'navigated elsewhere with the same link',
      newer: { workflowId: ID, keep: 'yes' },
      route: ID,
      stash: ID
    }
  ])(
    'leaves the link when the browser $name while an opened link cleared the URL',
    async ({ newer, route, stash }) => {
      serveFile()
      await navigate({ workflowId: ID })
      vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
      const cleanup = holdNavigation(isUrlCleanup)

      const attempt = loader.openWorkflowLinkFromUrl(true)
      await cleanup.arrived
      await navigate(newer)
      cleanup.release()

      expect(await attempt).toBe('opened')
      expect(currentQuery().workflowId).toBe(route)
      expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(stash)
      expect(
        useTelemetry()?.trackWorkflowLinkOpened
      ).toHaveBeenCalledExactlyOnceWith({
        outcome: 'opened',
        workspace_id: 'workspace-1'
      })
    }
  )

  it('leaves a newer link a navigation guard holds while an opened link cleared the URL', async () => {
    serveFile()
    await navigate({ workflowId: ID })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
    const cleanup = holdNavigation(isUrlCleanup)
    const signIn = holdNavigation(isNewerLink)

    const attempt = loader.openWorkflowLinkFromUrl(true)
    await cleanup.arrived
    const newerLink = navigate({ workflowId: NEXT_ID })
    await signIn.arrived
    cleanup.release()

    expect(await attempt).toBe('opened')
    expect(currentQuery()).toEqual({ workflowId: ID })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(NEXT_ID)
    signIn.release()
    await newerLink
    expect(currentQuery()).toEqual({ workflowId: NEXT_ID })
  })

  it('leaves a newer malformed link a navigation guard holds while an older malformed link is rejected', async () => {
    const request = vi.spyOn(api, 'fetchApi')
    await navigate({ workflowId: 'bad1' })
    const signIn = holdNavigation((to) => to.query.workflowId === 'bad2')
    const newerLink = navigate({ workflowId: 'bad2', topup: '1' })
    await signIn.arrived

    expect(await loader.openWorkflowLinkFromUrl(true)).toBe('pending')

    expect(request).not.toHaveBeenCalled()
    expect(currentQuery()).toEqual({ workflowId: 'bad1' })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe('bad2')
    signIn.release()
    await newerLink
    expect(currentQuery()).toEqual({ workflowId: 'bad2', topup: '1' })
  })

  it('leaves a newer empty link a navigation guard holds after a newer guard-held link superseded the lookup', async () => {
    const respond = holdLookup()
    await navigate({ workflowId: ID })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
    const newerHold = holdNavigation(isNewerLink)
    const emptyHold = holdNavigation((to) => to.query.workflowId === '')

    const attempt = loader.openWorkflowLinkFromUrl()
    const newerLink = navigate({ workflowId: NEXT_ID })
    await newerHold.arrived
    const emptyLink = navigate({ workflowId: '', topup: '1' })
    await emptyHold.arrived
    respond()

    expect(await attempt).toBe('pending')
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
    newerHold.release()
    emptyHold.release()
    await Promise.all([newerLink, emptyLink])
    expect(currentQuery()).toEqual({ workflowId: '', topup: '1' })

    expect(await loader.openWorkflowLinkFromUrl(true)).toBe('failed')

    expect(currentQuery()).toEqual({ topup: '1' })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBeUndefined()
    expect(loader.hasLinkInFlight()).toBe(false)
  })

  it('reports an empty link once when another navigation cancels its URL cleanup, and clears it later', async () => {
    await navigate({ workflowId: '' })
    const cleanup = holdNavigation((to) => isUrlCleanup(to) && !to.query.keep)

    const attempt = loader.openWorkflowLinkFromUrl(true)
    await cleanup.arrived
    await navigate({ keep: 'yes' })
    cleanup.release()

    expect(await attempt).toBe('failed')
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(',')
    expect(loader.hasLinkInFlight()).toBe(false)

    expect(await loader.openWorkflowLinkFromUrl(true)).toBe('failed')

    expect(currentQuery()).toEqual({ keep: 'yes' })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBeUndefined()
    expect(useToast().toasts).toHaveLength(1)
    expect(useTelemetry()?.trackWorkflowLinkOpened).toHaveBeenCalledTimes(1)
  })

  it('keeps a boot link opened when another navigation cancels its URL cleanup, and clears it later without reopening', async () => {
    serveFile()
    await navigate({ workflowId: ID })
    const { store } = await openExistingTab()
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (workflow) => {
        await store.openWorkflow(workflow)
        return true
      }
    )
    const cleanup = holdNavigation(isUrlCleanup)
    const linkedLoader = inApp(useLinkedWorkflowUrlLoader)

    const boot = linkedLoader.openLinkedWorkflowFromUrl()
    await cleanup.arrived
    await navigate({ workflowId: ID, keep: 'yes' })
    cleanup.release()

    expect(await boot).toBe('opened')
    expect(store.activeWorkflow?.path).toBe(PATH)
    expect(currentQuery()).toEqual({ workflowId: ID, keep: 'yes' })

    expect(await loader.openWorkflowLinkFromUrl(true)).toBe('opened')

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(store.activeWorkflow?.path).toBe(PATH)
    expect(currentQuery()).toEqual({ keep: 'yes' })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBeUndefined()
    expect(useTelemetry()?.trackWorkflowLinkOpened).toHaveBeenCalledTimes(1)
  })

  it('runs the URL actions without another replace while a newer link waits in a navigation guard', async () => {
    serveFile()
    await navigate({ workflowId: ID })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
    const replace = vi.spyOn(router, 'replace')
    const cleanup = holdNavigation(isUrlCleanup)
    const signIn = holdNavigation(isNewerLink)

    const actions = runUrlActions()
    await cleanup.arrived
    const newerLink = navigate({ workflowId: NEXT_ID })
    await signIn.arrived
    cleanup.release()
    await actions

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledOnce()
    expect(currentQuery()).toEqual({ workflowId: ID })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(NEXT_ID)
    signIn.release()
    await newerLink
    expect(currentQuery()).toEqual({ workflowId: NEXT_ID })
  })

  it('lets a newer link held in a navigation guard land when the older link also opens Settings', async () => {
    serveFile()
    await navigate({ workflowId: ID, settings: 'plan-credits' })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
    const cleanup = holdNavigation(isUrlCleanup)
    const signIn = holdNavigation(isNewerLink)

    const actions = runUrlActions()
    await cleanup.arrived
    const newerLink = navigate({ workflowId: NEXT_ID })
    await signIn.arrived
    cleanup.release()
    await actions
    signIn.release()
    await newerLink

    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(currentQuery()).toEqual({ workflowId: NEXT_ID })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(NEXT_ID)
  })

  it('lets a newer link held in a navigation guard land when the URL actions run after the boot link opened', async () => {
    serveFile()
    await navigate({ workflowId: ID })
    const { store } = await openExistingTab()
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (workflow) => {
        await store.openWorkflow(workflow)
        return true
      }
    )
    const replace = vi.spyOn(router, 'replace')
    const cleanup = holdNavigation(isUrlCleanup)
    const signIn = holdNavigation(isNewerLink)
    const linkedLoader = inApp(useLinkedWorkflowUrlLoader)

    const boot = linkedLoader.openLinkedWorkflowFromUrl()
    await cleanup.arrived
    const newerLink = navigate({ workflowId: NEXT_ID })
    await signIn.arrived
    cleanup.release()
    expect(await boot).toBe('opened')
    await runUrlActions()
    signIn.release()
    await newerLink

    expect(currentQuery()).toEqual({ workflowId: NEXT_ID })
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(NEXT_ID)
    expect(replace).toHaveBeenCalledOnce()
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
    expect(store.activeWorkflow?.path).toBe(PATH)
  })

  it('clears the other URL actions while a link from the stash waits for a workspace change', async () => {
    vi.spyOn(api, 'fetchApi').mockImplementation(async () => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      return new Response(null, { status: 404 })
    })
    await navigate({ workflowId: ID })
    await navigate({ topup: '1' })
    const replace = vi.spyOn(router, 'replace')

    await runUrlActions()

    expect(replace).toHaveBeenCalledOnce()
    expect(currentQuery()).toEqual({})
    expect(getPreservedQueryParam(NAMESPACE, 'workflowId')).toBe(ID)
    expect(useTelemetry()?.trackWorkflowLinkOpened).not.toHaveBeenCalled()
  })

  it('reports an opening error when the sidebar file is not in the workflow list after a sync', async () => {
    serveFile()
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([])
    await navigate({ workflowId: ID })

    expect(await loader.openWorkflowLinkFromUrl()).toBe('failed')

    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        surface: 'graph',
        errorType: 'error_opening_workflow_link'
      })
    )
  })

  it('keeps tabs unchanged when the sidebar file cannot be opened', async () => {
    serveFile()
    await navigate({ workflowId: ID })
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
