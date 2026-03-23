import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCreateWorkspaceUrlLoader } from './useCreateWorkspaceUrlLoader'

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  '@/platform/navigation/preservedQueryManager',
  () => preservedQueryMocks
)

const mockRouteQuery = vi.hoisted(() => ({
  value: {} as Record<string, string>
}))
const mockRouterReplace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mockRouteQuery.value
  }),
  useRouter: () => ({
    replace: mockRouterReplace
  })
}))

const mockShowTeamWorkspacesDialog = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTeamWorkspacesDialog: mockShowTeamWorkspacesDialog
  })
}))

describe('useCreateWorkspaceUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loadCreateWorkspaceFromUrl', () => {
    it('does nothing when no create_workspace param present', async () => {
      mockRouteQuery.value = {}

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(mockShowTeamWorkspacesDialog).not.toHaveBeenCalled()
      expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('opens create workspace dialog when param is present', async () => {
      mockRouteQuery.value = { create_workspace: '1' }

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(mockShowTeamWorkspacesDialog).toHaveBeenCalledOnce()
    })

    it('restores preserved query and opens dialog', async () => {
      mockRouteQuery.value = {}
      preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
        create_workspace: '1'
      })

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
        'create_workspace'
      )
      expect(mockRouterReplace).toHaveBeenCalledWith({
        query: { create_workspace: '1' }
      })
      expect(mockShowTeamWorkspacesDialog).toHaveBeenCalledOnce()
    })

    it('cleans up URL after processing', async () => {
      mockRouteQuery.value = { create_workspace: '1', other: 'param' }

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(mockRouterReplace).toHaveBeenCalledWith({
        query: { other: 'param' }
      })
    })

    it('clears preserved query after processing', async () => {
      mockRouteQuery.value = { create_workspace: '1' }

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'create_workspace'
      )
    })

    it('ignores empty param', async () => {
      mockRouteQuery.value = { create_workspace: '' }

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(mockShowTeamWorkspacesDialog).not.toHaveBeenCalled()
    })

    it('ignores non-string param', async () => {
      mockRouteQuery.value = {
        create_workspace: ['array'] as unknown as string
      }

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(mockShowTeamWorkspacesDialog).not.toHaveBeenCalled()
    })
  })
})
