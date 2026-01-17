import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInviteUrlLoader } from './useInviteUrlLoader'

/**
 * Unit tests for useInviteUrlLoader composable
 *
 * Tests the behavior of accepting workspace invites via URL query parameters:
 * - ?invite=TOKEN accepts the invite and shows success toast
 * - Invalid/missing token is handled gracefully
 * - API errors show error toast
 * - URL is cleaned up after processing
 */

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn()
}))

vi.mock(
  '@/platform/navigation/preservedQueryManager',
  () => preservedQueryMocks
)

// Mock toast store
const mockToastAdd = vi.fn()
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mockToastAdd
  })
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn((key: string, params?: Record<string, unknown>) => {
      if (key === 'workspace.inviteAccepted') return 'Invite Accepted'
      if (key === 'workspace.addedToWorkspace') {
        return `You have been added to ${params?.workspaceName}`
      }
      if (key === 'workspace.inviteFailed') return 'Failed to Accept Invite'
      if (key === 'g.error') return 'Error'
      return key
    })
  })
}))

describe('useInviteUrlLoader', () => {
  const mockReplaceState = vi.fn()
  const mockLocation = {
    search: '',
    href: 'https://cloud.comfy.org/',
    origin: 'https://cloud.comfy.org'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.search = ''
    mockLocation.href = 'https://cloud.comfy.org/'

    // Mock location using vi.stubGlobal
    vi.stubGlobal('location', mockLocation)

    // Mock history.replaceState
    vi.spyOn(window.history, 'replaceState').mockImplementation(
      mockReplaceState
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('getInviteTokenFromUrl', () => {
    it('returns null when no invite param present', () => {
      window.location.search = ''

      const { getInviteTokenFromUrl } = useInviteUrlLoader()
      const token = getInviteTokenFromUrl()

      expect(token).toBeNull()
    })

    it('returns token when invite param is present', () => {
      window.location.search = '?invite=test-token-123'

      const { getInviteTokenFromUrl } = useInviteUrlLoader()
      const token = getInviteTokenFromUrl()

      expect(token).toBe('test-token-123')
    })

    it('returns null for empty invite param', () => {
      window.location.search = '?invite='

      const { getInviteTokenFromUrl } = useInviteUrlLoader()
      const token = getInviteTokenFromUrl()

      expect(token).toBeNull()
    })

    it('returns null for whitespace-only invite param', () => {
      window.location.search = '?invite=%20%20'

      const { getInviteTokenFromUrl } = useInviteUrlLoader()
      const token = getInviteTokenFromUrl()

      expect(token).toBeNull()
    })
  })

  describe('clearInviteTokenFromUrl', () => {
    it('removes invite param from URL', () => {
      window.location.search = '?invite=test-token'
      window.location.href = 'https://cloud.comfy.org/?invite=test-token'

      const { clearInviteTokenFromUrl } = useInviteUrlLoader()
      clearInviteTokenFromUrl()

      expect(mockReplaceState).toHaveBeenCalledWith(
        window.history.state,
        '',
        'https://cloud.comfy.org/'
      )
    })

    it('preserves other query params when removing invite', () => {
      window.location.search = '?invite=test-token&other=param'
      window.location.href =
        'https://cloud.comfy.org/?invite=test-token&other=param'

      const { clearInviteTokenFromUrl } = useInviteUrlLoader()
      clearInviteTokenFromUrl()

      expect(mockReplaceState).toHaveBeenCalledWith(
        window.history.state,
        '',
        'https://cloud.comfy.org/?other=param'
      )
    })
  })

  describe('loadInviteFromUrl', () => {
    it('does nothing when no invite param present', async () => {
      window.location.search = ''

      const mockAcceptInvite = vi.fn()
      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl(mockAcceptInvite)

      expect(mockAcceptInvite).not.toHaveBeenCalled()
      expect(mockToastAdd).not.toHaveBeenCalled()
      expect(mockReplaceState).not.toHaveBeenCalled()
    })

    it('accepts invite and shows success toast on success', async () => {
      window.location.search = '?invite=valid-token'
      window.location.href = 'https://cloud.comfy.org/?invite=valid-token'

      const mockAcceptInvite = vi.fn().mockResolvedValue({
        workspaceId: 'ws-123',
        workspaceName: 'Test Workspace'
      })

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl(mockAcceptInvite)

      expect(mockAcceptInvite).toHaveBeenCalledWith('valid-token')
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'Invite Accepted',
        detail: 'You have been added to Test Workspace',
        life: 5000
      })
      expect(mockReplaceState).toHaveBeenCalled()
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })

    it('shows error toast when invite acceptance fails', async () => {
      window.location.search = '?invite=invalid-token'
      window.location.href = 'https://cloud.comfy.org/?invite=invalid-token'

      const mockAcceptInvite = vi
        .fn()
        .mockRejectedValue(new Error('Invalid invite'))

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl(mockAcceptInvite)

      expect(mockAcceptInvite).toHaveBeenCalledWith('invalid-token')
      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Failed to Accept Invite',
        detail: 'Error',
        life: 5000
      })
    })

    it('cleans up URL even on error', async () => {
      window.location.search = '?invite=invalid-token'
      window.location.href = 'https://cloud.comfy.org/?invite=invalid-token'

      const mockAcceptInvite = vi
        .fn()
        .mockRejectedValue(new Error('Invalid invite'))

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl(mockAcceptInvite)

      expect(mockReplaceState).toHaveBeenCalled()
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })

    it('clears preserved query on success', async () => {
      window.location.search = '?invite=valid-token'
      window.location.href = 'https://cloud.comfy.org/?invite=valid-token'

      const mockAcceptInvite = vi.fn().mockResolvedValue({
        workspaceId: 'ws-123',
        workspaceName: 'Test Workspace'
      })

      const { loadInviteFromUrl } = useInviteUrlLoader()
      await loadInviteFromUrl(mockAcceptInvite)

      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })
  })
})
