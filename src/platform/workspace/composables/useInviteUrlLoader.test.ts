import { fakeWebSessionUser } from '@comfyorg/account-core/testing'
import type { User } from 'firebase/auth'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/toast/toastStore'

import { WorkspaceApiError } from '../api/workspaceApi'
import { useTeamWorkspaceStore } from '../stores/teamWorkspaceStore'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock(import('@/services/dialogService'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('firebase/auth'))

const mockToastAdd = vi.hoisted(() => vi.fn())

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
            addedToNamedWorkspace: 'You have been added to {workspaceName}',
            viewWorkspace: 'View workspace',
            inviteFailed: 'Failed to Accept Invite',
            inviteSsoUnavailable: 'Ask your admin to add you',
            inviteSsoUnavailableDetail:
              'SSO accounts cannot accept invite links',
            inviteDirectoryManaged: 'Admin manages membership',
            inviteDirectoryManagedDetail: 'Ask your organization admin',
            switchFailed: 'Failed to switch workspace'
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

beforeEach(() => {
  vi.mocked(useToast().success).mockImplementation((...args: unknown[]) =>
    mockToastAdd('success', ...args)
  )
  vi.mocked(useToast().error).mockImplementation((...args: unknown[]) =>
    mockToastAdd('error', ...args)
  )
  vi.mocked(useToast().info).mockImplementation((...args: unknown[]) =>
    mockToastAdd('info', ...args)
  )
  vi.mocked(useToast().warning).mockImplementation((...args: unknown[]) =>
    mockToastAdd('warning', ...args)
  )
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
      expect(mockToastAdd).toHaveBeenCalledWith(
        'success',
        'Invite Accepted',
        expect.objectContaining({
          description: 'You have been added to Test Workspace',
          action: expect.objectContaining({ label: 'View workspace' })
        })
      )
    })

    it.for([
      {
        name: 'dismisses the toast once the switch succeeds',
        switchWorkspace: () => Promise.resolve(),
        dismissals: 1,
        errors: []
      },
      {
        name: 'keeps the toast and reports a failed switch',
        switchWorkspace: () => Promise.reject(new Error('switch failed')),
        dismissals: 0,
        errors: [['error', 'Failed to switch workspace', { duration: 5000 }]]
      }
    ])(
      'View workspace $name',
      async ({ switchWorkspace, dismissals, errors }) => {
        mockRouteQuery.value = { invite: 'valid-token' }
        vi.mocked(useTeamWorkspaceStore().acceptInvite).mockResolvedValue({
          workspaceId: 'ws-123',
          workspaceName: 'Test Workspace'
        })
        vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockImplementation(
          switchWorkspace
        )
        await useInviteUrlLoader().loadInviteFromUrl()
        const [, , options] = mockToastAdd.mock.calls.at(-1) ?? []
        assert(options?.action)

        await options.action.onClick()

        expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith(
          'ws-123'
        )
        expect(useToast().dismiss).toHaveBeenCalledTimes(dismissals)
        expect(
          mockToastAdd.mock.calls.filter(([kind]) => kind === 'error')
        ).toEqual(errors)
      }
    )

    it('shows the invalid-link dialog instead of a toast on 404', async () => {
      mockRouteQuery.value = { invite: 'dead-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new WorkspaceApiError('Invite not found or expired', 404, 'NOT_FOUND')
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(
        vi.mocked(useDialogService().showInviteLinkInvalidDialog)
      ).toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    })

    it('shows the wrong-account dialog with the token on 403', async () => {
      mockRouteQuery.value = { invite: 'other-account-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new WorkspaceApiError(
          'Email does not match invite',
          403,
          'ACCESS_DENIED'
        )
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(
        vi.mocked(useDialogService().showInviteLinkInvalidDialog)
      ).not.toHaveBeenCalled()
      expect(
        vi.mocked(useDialogService().showInviteWrongAccountDialog)
      ).toHaveBeenCalledWith({ inviteToken: 'other-account-token' })
      expect(mockToastAdd).not.toHaveBeenCalled()
    })

    const DIRECTORY_TOAST = [
      'info',
      'Admin manages membership',
      { description: 'Ask your organization admin' }
    ]

    it.for([
      {
        name: 'a directory-managed refusal with sso_enabled on shows the directory message',
        sso: true,
        code: 'membership_managed_by_directory',
        wrongAccountDialogs: 0,
        toasts: [DIRECTORY_TOAST]
      },
      {
        name: 'a directory-managed refusal with sso_enabled off opens the wrong-account dialog',
        sso: false,
        code: 'membership_managed_by_directory',
        wrongAccountDialogs: 1,
        toasts: []
      },
      {
        name: 'another 403 with sso_enabled on opens the wrong-account dialog',
        sso: true,
        code: 'ACCESS_DENIED',
        wrongAccountDialogs: 1,
        toasts: []
      }
    ])('$name', async ({ sso, code, wrongAccountDialogs, toasts }) => {
      vi.mocked(useFeatureFlags().flags).ssoEnabled = sso
      mockRouteQuery.value = { invite: 'scim-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new WorkspaceApiError('Forbidden', 403, code)
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(
        vi.mocked(useDialogService().showInviteWrongAccountDialog)
      ).toHaveBeenCalledTimes(wrongAccountDialogs)
      expect(mockToastAdd.mock.calls).toEqual(toasts)
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })

    it('keeps the toast for a 404 without a parsed API code', async () => {
      mockRouteQuery.value = { invite: 'waf-blocked' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new WorkspaceApiError('Forbidden', 404, undefined)
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl()

      expect(
        vi.mocked(useDialogService().showInviteLinkInvalidDialog)
      ).not.toHaveBeenCalled()
      expect(vi.mocked(useToast().error)).toHaveBeenCalled()
    })

    it('falls back to the toast when the dialog chunk fails to load', async () => {
      mockRouteQuery.value = { invite: 'dead-token' }
      vi.mocked(useTeamWorkspaceStore().acceptInvite).mockRejectedValue(
        new WorkspaceApiError('Invite not found or expired', 404, 'NOT_FOUND')
      )
      vi.mocked(
        useDialogService().showInviteLinkInvalidDialog
      ).mockRejectedValue(
        new Error('failed to fetch dynamically imported module')
      )

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await expect(loadInviteFromUrl()).resolves.toBeUndefined()

      expect(vi.mocked(useToast().error)).toHaveBeenCalled()
      vi.mocked(useDialogService().showInviteLinkInvalidDialog).mockReset()
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
      expect(vi.mocked(useToast().error)).toHaveBeenCalledWith(
        'Failed to Accept Invite',
        { description: 'Invalid invite' }
      )
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
      expect(vi.mocked(useToast().error)).toHaveBeenCalledWith(
        'Failed to Accept Invite',
        { description: 'Invalid token' }
      )
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

    it.for([
      {
        name: 'an SSO session',
        sso: true,
        provider: 'saml.workos',
        firebase: false,
        accepts: false
      },
      {
        name: 'an OIDC SSO session',
        sso: true,
        provider: 'oidc.workos',
        firebase: false,
        accepts: false
      },
      {
        name: 'an SSO session beside its Firebase login',
        sso: true,
        provider: 'saml.workos',
        firebase: true,
        accepts: true
      },
      {
        name: 'a Google session',
        sso: true,
        provider: 'google.com',
        firebase: false,
        accepts: true
      },
      {
        name: 'an SSO session with sso_enabled off',
        sso: false,
        provider: 'saml.workos',
        firebase: false,
        accepts: true
      }
    ])(
      'accepts the invite for $name only when it has a Firebase login to accept with',
      async ({ sso, provider, firebase, accepts }) => {
        vi.mocked(useFeatureFlags().flags).ssoEnabled = sso
        const authStore = useAuthStore()
        authStore.currentUser = firebase
          ? fromPartial<User>({ uid: 'session-user' })
          : null
        Object.assign(authStore, {
          sessionUser: fakeWebSessionUser({
            id: 'session-user',
            signInProvider: provider
          })
        })
        mockRouteQuery.value = { invite: 'valid-token' }
        vi.mocked(useTeamWorkspaceStore().acceptInvite).mockResolvedValue({
          workspaceId: 'ws-123',
          workspaceName: 'Test Workspace'
        })

        const { loadInviteFromUrl } = useInviteUrlLoader()
        await loadInviteFromUrl()

        expect(
          vi.mocked(useTeamWorkspaceStore().acceptInvite).mock.calls.length
        ).toBe(accepts ? 1 : 0)
        expect(
          mockToastAdd.mock.calls.some(
            ([, title]) => title === 'Ask your admin to add you'
          )
        ).toBe(!accepts)
        expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
        expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
          'invite'
        )
      }
    )
  })
})
