import { setImmediate } from 'node:timers/promises'
import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

import { useDeploymentUrlLoader as createDeploymentUrlLoader } from './useDeploymentUrlLoader'

vi.mock(import('@/composables/auth/useCurrentUser'))

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  import('@/platform/navigation/preservedQueryManager'),
  () => preservedQueryMocks
)

const mockOpenFolderWorkflows = vi.hoisted(() => vi.fn(async () => true))

vi.mock(
  import('@/platform/workflow/management/composables/useFolderWorkflowsUrlLoader'),
  () => ({
    useFolderWorkflowsUrlLoader: () => ({
      openFolderWorkflowsFromUrl: vi.fn(),
      openFolderWorkflows: mockOpenFolderWorkflows
    })
  })
)

const mockRouteQuery = vi.hoisted(() => ({
  value: {} as Record<string, unknown>
}))
const mockRouterReplace = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock<unknown>(import('vue-router'), () => ({
  useRoute: () => ({
    query: mockRouteQuery.value
  }),
  useRouter: () => ({
    replace: mockRouterReplace
  })
}))

const apps: App<Element>[] = []

function useDeploymentUrlLoader(): ReturnType<
  typeof createDeploymentUrlLoader
> {
  let result: ReturnType<typeof createDeploymentUrlLoader> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createDeploymentUrlLoader()
        return () => null
      }
    })
  )
  app.use(
    createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          deploymentSwitcher: {
            linkRefused: "Couldn't open this deployment",
            linkTimedOut:
              'This deployment took too long to open. Try the link again.',
            linkWorkspaceRefused:
              "Couldn't switch to that workspace. You're still in {workspaceName}."
          }
        }
      }
    })
  )
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('deployment URL loader not initialized')
  return result
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

const homeBase = {
  id: 'ws-1',
  name: 'Home Base',
  type: 'personal' as const,
  role: 'owner' as const,
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
}
const studio = {
  ...homeBase,
  id: 'ws-2',
  name: 'Studio',
  type: 'team' as const,
  role: 'member' as const
}

const STAYED = "Couldn't switch to that workspace. You're still in Home Base."

describe('useDeploymentUrlLoader', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockOpenFolderWorkflows.mockClear()
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(undefined)
    mockRouterReplace.mockResolvedValue(undefined)
    Object.assign(useTeamWorkspaceStore(), { activeWorkspace: homeBase })
    vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockResolvedValue(true)
    vi.mocked(useDeploymentPickStore().pickFromLink).mockResolvedValue({
      kind: 'picked'
    })
  })

  it('does nothing when the URL has no deployment link', async () => {
    mockRouteQuery.value = { workflow: 'keep-me' }

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(false)

    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useDeploymentPickStore().pickFromLink).not.toHaveBeenCalled()
  })

  it('in the named workspace, strips both params and then picks the deployment', async () => {
    mockRouteQuery.value = {
      workspace: 'ws-1',
      deployment: 'dep-1',
      other: 'param'
    }

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(true)

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith('dep-1')
    // The pick reloads the page, which would run the link again if the
    // params were still in the address.
    expect(mockRouterReplace.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(useDeploymentPickStore().pickFromLink).mock
        .invocationCallOrder[0]
    )
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useToast().error).not.toHaveBeenCalled()
  })

  it("keeps the link's workflows folder in the URL for the boot after the pick's reload", async () => {
    mockRouteQuery.value = {
      workspace: 'ws-1',
      deployment: 'dep-1',
      workflows: 'build'
    }

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(true)

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { workflows: 'build' }
    })
    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith('dep-1')
  })

  it('picks Comfy Cloud itself for deployment=standard, keeping the folder', async () => {
    mockRouteQuery.value = {
      workspace: 'ws-1',
      deployment: 'standard',
      workflows: 'build'
    }

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(true)

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { workflows: 'build' }
    })
    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith(null)
  })

  it('says nothing for deployment=standard when the browser is on Comfy Cloud', async () => {
    mockRouteQuery.value = { workspace: 'ws-1', deployment: 'standard' }
    vi.mocked(useDeploymentPickStore().pickFromLink).mockResolvedValue({
      kind: 'unchanged'
    })

    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(false)

    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith(null)
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useToast().error).not.toHaveBeenCalled()
  })

  it('shows the timed-out message when deployment=standard does not land', async () => {
    mockRouteQuery.value = { workspace: 'ws-1', deployment: 'standard' }
    vi.mocked(useDeploymentPickStore().pickFromLink).mockResolvedValue({
      kind: 'timedOut'
    })

    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(false)

    expect(useToast().error).toHaveBeenCalledWith(
      'This deployment took too long to open. Try the link again.',
      { duration: 8000 }
    )
  })

  it('switches workspace for deployment=standard, then picks Comfy Cloud', async () => {
    mockRouteQuery.value = {
      workspace: 'ws-2',
      deployment: 'standard',
      workflows: 'build'
    }

    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(true)
    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith('ws-2')
    expect(mockRouterReplace).not.toHaveBeenCalled()

    Object.assign(useTeamWorkspaceStore(), { activeWorkspace: studio })
    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(true)
    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { workflows: 'build' }
    })
    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith(null)
  })

  it('waits for URL cleanup to complete before starting the pick', async () => {
    mockRouteQuery.value = { workspace: 'ws-1', deployment: 'dep-1' }
    let finishCleanup!: () => void
    const cleanup = new Promise<undefined>((resolve) => {
      finishCleanup = () => resolve(undefined)
    })
    mockRouterReplace.mockReturnValue(cleanup)
    const loading = useDeploymentUrlLoader().loadDeploymentFromUrl()
    await setImmediate()
    expect(useDeploymentPickStore().pickFromLink).not.toHaveBeenCalled()
    finishCleanup()
    await expect(loading).resolves.toBe(true)
    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith('dep-1')
  })

  it('stays in the workspace when the retry marker cannot be saved', async () => {
    mockRouteQuery.value = { workspace: 'ws-2', deployment: 'dep-1' }
    const save = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    })
    try {
      await expect(
        useDeploymentUrlLoader().loadDeploymentFromUrl()
      ).resolves.toBe(false)
      expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
      expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
      expect(useToast().error).toHaveBeenCalledWith(STAYED, { duration: 8000 })
    } finally {
      save.mockRestore()
    }
  })

  it('still switches when a retained switch marker cannot be removed', async () => {
    mockRouteQuery.value = { workspace: 'ws-2', deployment: 'dep-1' }
    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEYS.DEPLOYMENT_LINK_SWITCH,
      'ws-2'
    )
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(true)
    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith('ws-2')
    expect(useToast().error).not.toHaveBeenCalled()
  })

  it('switches to another workspace keeping the link, and picks on the boot after the reload', async () => {
    mockRouteQuery.value = { workspace: 'ws-2', deployment: 'dep-1' }

    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(true)

    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith('ws-2')
    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(useDeploymentPickStore().pickFromLink).not.toHaveBeenCalled()

    // The reload lands in the named workspace with the link still there.
    Object.assign(useTeamWorkspaceStore(), { activeWorkspace: studio })
    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(true)

    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledOnce()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith('dep-1')
  })

  it('stays put and says so when the switch to the named workspace is refused', async () => {
    mockRouteQuery.value = { workspace: 'ws-9', deployment: 'dep-1' }
    vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockRejectedValue(
      new Error('Workspace not found or access denied')
    )

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(false)

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useDeploymentPickStore().pickFromLink).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledWith(STAYED, { duration: 8000 })
  })

  // A switch reloads the page; if the boot after it lands elsewhere (the
  // workspace was left meanwhile), switching again would reload forever.
  it('never switches twice for one link when the switch did not land', async () => {
    mockRouteQuery.value = { workspace: 'ws-2', deployment: 'dep-1' }
    await useDeploymentUrlLoader().loadDeploymentFromUrl()

    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(false)

    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledOnce()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useDeploymentPickStore().pickFromLink).not.toHaveBeenCalled()
    expect(useToast().error).toHaveBeenCalledWith(STAYED, { duration: 8000 })
  })

  it("shows the server's refusal of the pick, strips the params, and stays", async () => {
    mockRouteQuery.value = { workspace: 'ws-1', deployment: 'dep-gone' }
    vi.mocked(useDeploymentPickStore().pickFromLink).mockResolvedValue({
      kind: 'refused',
      message: "deployment dep-gone is not one of this workspace's"
    })

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(false)

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useToast().error).toHaveBeenCalledWith(
      "Couldn't open this deployment",
      {
        description: "deployment dep-gone is not one of this workspace's",
        duration: 8000
      }
    )
  })

  it('lets startup continue with a retry message after the listing times out', async () => {
    mockRouteQuery.value = { workspace: 'ws-1', deployment: 'dep-1' }
    vi.mocked(useDeploymentPickStore().pickFromLink).mockResolvedValue({
      kind: 'timedOut'
    })
    await expect(
      useDeploymentUrlLoader().loadDeploymentFromUrl()
    ).resolves.toBe(false)
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useToast().error).toHaveBeenCalledWith(
      'This deployment took too long to open. Try the link again.',
      { duration: 8000 }
    )
  })

  it('strips the params and says nothing when the browser already runs on the deployment', async () => {
    mockRouteQuery.value = { workspace: 'ws-1', deployment: 'dep-2' }
    vi.mocked(useDeploymentPickStore().pickFromLink).mockResolvedValue({
      kind: 'unchanged'
    })

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(false)

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useToast().error).not.toHaveBeenCalled()
  })

  describe('when the browser already runs on the linked deployment', () => {
    const onBuild = {
      deployment_id: 'dep-2',
      build_id: '0f3c9a7e-5b21-4c8d-9e2a-1b2c3d4e5f60',
      build_name: 'Portrait studio',
      release_id: 'rel-1',
      can_start: true,
      created_at: '2026-11-20T00:00:00Z',
      status: 'ready' as const
    }

    beforeEach(() => {
      vi.mocked(useDeploymentPickStore().pickFromLink).mockResolvedValue({
        kind: 'unchanged'
      })
      Object.assign(useDeploymentPickStore(), {
        pickedDeploymentId: 'dep-2',
        pickedDeployment: onBuild
      })
    })

    it("opens its Build's workflows, as the reload after a pick would", async () => {
      mockRouteQuery.value = { workspace: 'ws-1', deployment: 'dep-2' }

      await useDeploymentUrlLoader().loadDeploymentFromUrl()

      expect(mockOpenFolderWorkflows).toHaveBeenCalledWith(
        'Portrait studio (0f3c9a7e)'
      )
    })

    it.for([{ workflows: 'build' }, { workflowId: 'wf-1' }])(
      'leaves a link that names its own workflow to that workflow: %o',
      async (named) => {
        mockRouteQuery.value = {
          workspace: 'ws-1',
          deployment: 'dep-2',
          ...named
        }

        await useDeploymentUrlLoader().loadDeploymentFromUrl()

        expect(mockOpenFolderWorkflows).not.toHaveBeenCalled()
      }
    )

    it('opens nothing when the deployment has no known Build', async () => {
      mockRouteQuery.value = { workspace: 'ws-1', deployment: 'dep-2' }
      Object.assign(useDeploymentPickStore(), {
        pickedDeployment: { ...onBuild, build_id: undefined }
      })

      await useDeploymentUrlLoader().loadDeploymentFromUrl()

      expect(mockOpenFolderWorkflows).not.toHaveBeenCalled()
    })
  })

  it('acts on a link the sign-in redirect carried in the preserved-query stash', async () => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockImplementation(
      (namespace: string, query: Record<string, unknown>) =>
        namespace === 'workspace'
          ? { ...query, workspace: 'ws-1' }
          : { ...query, deployment: 'dep-1' }
    )

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(true)

    expect(useDeploymentPickStore().pickFromLink).toHaveBeenCalledWith('dep-1')
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'workspace'
    )
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'deployment'
    )
  })

  // An API-key session is bound to one workspace and cannot pick.
  it('does not act for an API-key login, and leaves ?workspace to its own loader', async () => {
    Object.assign(useCurrentUser(), { isApiKeyLogin: computed(() => true) })
    mockRouteQuery.value = { workspace: 'ws-2', deployment: 'dep-1' }

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(false)

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { workspace: 'ws-2' }
    })
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useDeploymentPickStore().pickFromLink).not.toHaveBeenCalled()
  })

  it.for([
    { when: 'the workspace is missing', query: { deployment: 'dep-1' } },
    {
      when: 'the deployment is empty',
      query: { workspace: 'ws-2', deployment: '' }
    },
    {
      when: 'the deployment is bare',
      query: { workspace: 'ws-2', deployment: null }
    },
    {
      when: 'the deployment is repeated',
      query: { workspace: 'ws-2', deployment: ['dep-1', 'dep-2'] }
    },
    {
      when: 'the stash joined a repeated deployment',
      query: { workspace: 'ws-2', deployment: 'dep-1,dep-2' }
    }
  ])('does not act when $when', async ({ query }) => {
    mockRouteQuery.value = fromAny<Record<string, unknown>, unknown>(query)

    const { loadDeploymentFromUrl } = useDeploymentUrlLoader()
    await expect(loadDeploymentFromUrl()).resolves.toBe(false)

    const { deployment: _dropped, ...kept } = query
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: kept })
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useDeploymentPickStore().pickFromLink).not.toHaveBeenCalled()
  })
})
