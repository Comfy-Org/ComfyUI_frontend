import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'
import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast'

import { useWorkspaceUrlLoader as createWorkspaceUrlLoader } from './useWorkspaceUrlLoader'

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  import('@/platform/navigation/preservedQueryManager'),
  () => preservedQueryMocks
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

function useWorkspaceUrlLoader(): ReturnType<typeof createWorkspaceUrlLoader> {
  let result: ReturnType<typeof createWorkspaceUrlLoader> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createWorkspaceUrlLoader()
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
          workspace: {
            deepLinkStayed:
              "Couldn't open that workspace. You're still in {workspaceName}."
          }
        }
      }
    })
  )
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('workspace URL loader not initialized')
  return result
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

const activeWorkspace = {
  id: 'workspace-1',
  name: 'Home Base',
  type: 'personal' as const,
  role: 'owner' as const,
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
}

describe('useWorkspaceUrlLoader', () => {
  beforeEach(() => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
    vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockResolvedValue(
      undefined
    )
    Object.assign(useTeamWorkspaceStore(), { activeWorkspace })
  })

  it('does nothing when no workspace param present', async () => {
    mockRouteQuery.value = {}

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useToast().info).not.toHaveBeenCalled()
  })

  it('switches into a member workspace named by the link', async () => {
    mockRouteQuery.value = { workspace: 'workspace-2', other: 'param' }

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith(
      'workspace-2'
    )
    expect(useToast().info).not.toHaveBeenCalled()
  })

  it('strips the param before switching, so a reload does not re-trigger it', async () => {
    mockRouteQuery.value = { workspace: 'workspace-2' }
    const callOrder: string[] = []
    mockRouterReplace.mockImplementationOnce(async () => {
      callOrder.push('strip')
    })
    vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockImplementationOnce(
      async () => {
        callOrder.push('switch')
      }
    )

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(callOrder).toEqual(['strip', 'switch'])
  })

  it('resolves normally when the strip replace rejects, instead of throwing', async () => {
    mockRouteQuery.value = { workspace: 'workspace-2' }
    mockRouterReplace.mockRejectedValueOnce(new Error('navigation cancelled'))

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()

    // Throwing here (instead of resolving) would fail the test on its own.
    await loadWorkspaceFromUrl()

    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith(
      'workspace-2'
    )
  })

  it('stays on the active workspace and shows a toast when the switch is refused', async () => {
    mockRouteQuery.value = { workspace: 'workspace-2' }
    vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockRejectedValue(
      new Error('Workspace not found or access denied')
    )

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useToast().info).toHaveBeenCalledWith(
      "Couldn't open that workspace. You're still in Home Base."
    )
  })

  it('stays on the active workspace and shows a toast for an invalid link', async () => {
    mockRouteQuery.value = fromAny<Record<string, string>, unknown>({
      workspace: ['workspace-2', 'workspace-3']
    })

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useToast().info).toHaveBeenCalledWith(
      "Couldn't open that workspace. You're still in Home Base."
    )
  })

  it('stays on the active workspace and shows a toast for a bare ?workspace with no value', async () => {
    // A bare `?workspace` (no `=`) reaches the router as null, distinct from
    // a genuinely missing param (undefined) — the former is present but
    // empty and must read as invalid, not absent.
    mockRouteQuery.value = { workspace: null }

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useToast().info).toHaveBeenCalledWith(
      "Couldn't open that workspace. You're still in Home Base."
    )
  })

  it('treats a repeated link with one bare entry as invalid', async () => {
    mockRouteQuery.value = fromAny<Record<string, string>, unknown>({
      workspace: [null, 'workspace-2']
    })

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useToast().info).toHaveBeenCalledWith(
      "Couldn't open that workspace. You're still in Home Base."
    )
  })

  it('treats a joined stash value from a repeated login-redirect link as invalid', async () => {
    // router.ts's `rejectRepeated` stashes a repeated value joined with `,`
    // (outside any real workspace id's charset) instead of just the first,
    // so a link that was invalid before the redirect reads as invalid after
    // it too, rather than resolving to one of the colliding values.
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      workspace: 'workspace-2,workspace-3'
    })

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useToast().info).toHaveBeenCalledWith(
      "Couldn't open that workspace. You're still in Home Base."
    )
  })

  it('is a silent no-op when the link already names the active workspace', async () => {
    mockRouteQuery.value = { workspace: 'workspace-1' }

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    expect(useToast().info).not.toHaveBeenCalled()
  })

  it('restores the link after a login redirect via the preserved query', async () => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      workspace: 'workspace-2'
    })

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'workspace'
    )
    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith(
      'workspace-2'
    )
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'workspace'
    )
  })

  it('runs before the caller can read settings/pricing from the same URL', async () => {
    // ?settings=plan-credits&workspace=workspace-2: the workspace switch must
    // resolve before a caller (useUrlActionLoaders) proceeds to the settings
    // loader, so it opens the requested workspace's settings.
    mockRouteQuery.value = {
      settings: 'plan-credits',
      workspace: 'workspace-2'
    }

    const { loadWorkspaceFromUrl } = useWorkspaceUrlLoader()
    await loadWorkspaceFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { settings: 'plan-credits' }
    })
    expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith(
      'workspace-2'
    )
  })
})
