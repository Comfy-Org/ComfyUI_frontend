import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'
import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import { useInviteUrlLoader as createInviteUrlLoader } from './useInviteUrlLoader'

/**
 * Unit tests for useInviteUrlLoader composable
 *
 * Tests the behavior of accepting workspace invites via URL query parameters:
 * - ?invite=TOKEN accepts the invite and shows success toast
 * - Invalid/missing token is handled gracefully
 * - API errors show error toast
 * - URL is cleaned up after processing
 * - Preserved query is restored after login redirect
 */

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
const mockRouterReplace = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('vue-router'), () => ({
  useRoute: () => ({
    query: mockRouteQuery.value
  }),
  useRouter: () => ({
    replace: mockRouterReplace
  })
}))

const mockToastAdd = vi.hoisted(() => vi.fn())
vi.mock<unknown>(
  import('primevue/usetoast'), // eslint-disable-line primevue-removal/no-imports
  () => ({
    useToast: () => ({
      add: mockToastAdd
    })
  })
)

const apps: App<Element>[] = []

function useInviteUrlLoader(): ReturnType<typeof createInviteUrlLoader> {
  let result: ReturnType<typeof createInviteUrlLoader> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createInviteUrlLoader()
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
            inviteAccepted: 'Invite Accepted',
            addedToWorkspace: 'You have been added to {workspaceName}',
            inviteFailed: 'Failed to Accept Invite'
          },
          g: { unknownError: 'Unknown error' }
        }
      }
    })
  )
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('invite URL loader not initialized')
  return result
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

describe('useInviteUrlLoader', () => {
  beforeEach(() => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  describe('loadInviteFromUrl', () => {
    it('does nothing when no invite param present', async () => {
      mockRouteQuery.value = {}

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(useTeamWorkspaceStore().acceptInvite).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockRouterReplace).not.toHaveBeenCalled()
    })

    it('restores preserved query and processes invite', async () => {
      mockRouteQuery.value = {}
      preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
        invite: 'preserved-token'
      })
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockResolvedValue({
        workspaceId: 'ws-123',
        workspaceName: 'Test Workspace'
      })

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
      expect(mockRouterReplace).toHaveBeenCalledWith({
        query: { invite: 'preserved-token' }
      })
      expect(useTeamWorkspaceStore().acceptInvite).toHaveBeenCalledWith(
        'preserved-token'
      )
    })

    it('accepts invite and shows success toast on success', async () => {
      mockRouteQuery.value = { invite: 'valid-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockResolvedValue({
        workspaceId: 'ws-123',
        workspaceName: 'Test Workspace'
      })

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(useTeamWorkspaceStore().acceptInvite).toHaveBeenCalledWith(
        'valid-token'
      )
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'Invite Accepted',
        detail: {
          text: 'You have been added to Test Workspace',
          workspaceId: 'ws-123',
          workspaceName: 'Test Workspace'
        },
        group: 'invite-accepted',
        closable: true
      })
    })

    it('shows error toast when invite acceptance fails', async () => {
      mockRouteQuery.value = { invite: 'invalid-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new Error('Invalid invite')
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(useTeamWorkspaceStore().acceptInvite).toHaveBeenCalledWith(
        'invalid-token'
      )
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Failed to Accept Invite',
        detail: 'Invalid invite'
      })
    })

    it('cleans up URL after processing invite', async () => {
      mockRouteQuery.value = { invite: 'valid-token', other: 'param' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockResolvedValue({
        workspaceId: 'ws-123',
        workspaceName: 'Test Workspace'
      })

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      // Should replace with query without invite param
      expect(mockRouterReplace).toHaveBeenCalledWith({
        query: { other: 'param' }
      })
    })

    it('clears preserved query after processing', async () => {
      mockRouteQuery.value = { invite: 'valid-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockResolvedValue({
        workspaceId: 'ws-123',
        workspaceName: 'Test Workspace'
      })

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })

    it('clears preserved query even on error', async () => {
      mockRouteQuery.value = { invite: 'invalid-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new Error('Invalid invite')
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })

    it('sends any token format to backend for validation', async () => {
      mockRouteQuery.value = { invite: 'any-token-format==' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new Error('Invalid token')
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      // Token is sent to backend, which validates and rejects
      expect(useTeamWorkspaceStore().acceptInvite).toHaveBeenCalledWith(
        'any-token-format=='
      )
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Failed to Accept Invite',
        detail: 'Invalid token'
      })
    })

    it('ignores empty invite param', async () => {
      mockRouteQuery.value = { invite: '' }

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(useTeamWorkspaceStore().acceptInvite).not.toHaveBeenCalled()
    })

    it('ignores non-string invite param', async () => {
      mockRouteQuery.value = {
        invite: fromAny<string, unknown>(['array', 'value'])
      }

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(useTeamWorkspaceStore().acceptInvite).not.toHaveBeenCalled()
    })
  })
})
