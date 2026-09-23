import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogService } from '@/services/dialogService'

import { useCreateWorkspaceUrlLoader } from './useCreateWorkspaceUrlLoader'

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
  value: {} as Record<string, string>
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

vi.mock(import('@/services/dialogService'))

describe('useCreateWorkspaceUrlLoader', () => {
  beforeEach(() => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  describe('loadCreateWorkspaceFromUrl', () => {
    it('does nothing when no create_workspace param present', async () => {
      mockRouteQuery.value = {}

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(useDialogService().showTeamWorkspacesDialog).not.toHaveBeenCalled()
      expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('opens create workspace dialog when param is present', async () => {
      mockRouteQuery.value = { create_workspace: '1' }

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(useDialogService().showTeamWorkspacesDialog).toHaveBeenCalledOnce()
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
      expect(useDialogService().showTeamWorkspacesDialog).toHaveBeenCalledOnce()
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

      expect(useDialogService().showTeamWorkspacesDialog).not.toHaveBeenCalled()
    })

    it('ignores non-string param', async () => {
      mockRouteQuery.value = {
        create_workspace: fromAny<string, unknown>(['array'])
      }

      const { loadCreateWorkspaceFromUrl } = useCreateWorkspaceUrlLoader()
      await loadCreateWorkspaceFromUrl()

      expect(useDialogService().showTeamWorkspacesDialog).not.toHaveBeenCalled()
    })
  })
})
