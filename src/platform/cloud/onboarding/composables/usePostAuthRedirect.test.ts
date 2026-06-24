import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePostAuthRedirect } from './usePostAuthRedirect'

const hoisted = vi.hoisted(() => ({
  authStore: {
    currentUser: { uid: 'user-123' }
  },
  completeDesktopLoginIfNeeded: vi.fn(),
  getSafePreviousFullPath: vi.fn(),
  resumeOAuthIfNeeded: vi.fn(),
  route: {
    query: {
      desktop_login_callback: 'http://localhost:9876/callback',
      desktop_login_state: 'state-123'
    }
  },
  router: {
    push: vi.fn(),
    replace: vi.fn()
  },
  toastStore: {
    add: vi.fn()
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => hoisted.route,
  useRouter: () => hoisted.router
}))

vi.mock('@/platform/cloud/oauth/useOAuthPostLoginRedirect', () => ({
  useOAuthPostLoginRedirect: () => ({
    resumeOAuthIfNeeded: hoisted.resumeOAuthIfNeeded
  })
}))

vi.mock('@/platform/cloud/onboarding/desktopLoginBridge', () => ({
  completeDesktopLoginIfNeeded: hoisted.completeDesktopLoginIfNeeded
}))

vi.mock('@/platform/cloud/onboarding/utils/previousFullPath', () => ({
  getSafePreviousFullPath: hoisted.getSafePreviousFullPath
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => hoisted.toastStore
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => hoisted.authStore
}))

function createRedirect() {
  const authError = ref('')
  const defaultRedirect = vi.fn(() => ({ name: 'cloud-user-check' }))
  const { onAuthSuccess } = usePostAuthRedirect({
    authError,
    successSummary: 'Login Completed',
    defaultRedirect
  })

  return { authError, defaultRedirect, onAuthSuccess }
}

describe('usePostAuthRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.authStore.currentUser = { uid: 'user-123' }
    hoisted.route.query = {
      desktop_login_callback: 'http://localhost:9876/callback',
      desktop_login_state: 'state-123'
    }
    hoisted.completeDesktopLoginIfNeeded.mockResolvedValue(false)
    hoisted.getSafePreviousFullPath.mockReturnValue(null)
    hoisted.resumeOAuthIfNeeded.mockResolvedValue({ kind: 'no-oauth' })
    hoisted.router.push.mockResolvedValue(undefined)
    hoisted.router.replace.mockResolvedValue(undefined)
  })

  it('stops redirect handling after completing the desktop login callback', async () => {
    hoisted.completeDesktopLoginIfNeeded.mockResolvedValue(true)
    const { defaultRedirect, onAuthSuccess } = createRedirect()

    await onAuthSuccess()

    expect(hoisted.completeDesktopLoginIfNeeded).toHaveBeenCalledWith(
      hoisted.route.query,
      hoisted.authStore.currentUser
    )
    expect(hoisted.toastStore.add).not.toHaveBeenCalled()
    expect(hoisted.resumeOAuthIfNeeded).not.toHaveBeenCalled()
    expect(hoisted.router.push).not.toHaveBeenCalled()
    expect(hoisted.router.replace).not.toHaveBeenCalled()
    expect(defaultRedirect).not.toHaveBeenCalled()
  })

  it('surfaces desktop login callback failures without continuing redirects', async () => {
    hoisted.completeDesktopLoginIfNeeded.mockRejectedValue(
      new Error('Desktop login callback returned 500')
    )
    const { authError, onAuthSuccess } = createRedirect()

    await onAuthSuccess()

    expect(authError.value).toBe('Desktop login callback returned 500')
    expect(hoisted.toastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'Desktop login callback returned 500',
      life: 4000
    })
    expect(hoisted.resumeOAuthIfNeeded).not.toHaveBeenCalled()
    expect(hoisted.router.push).not.toHaveBeenCalled()
    expect(hoisted.router.replace).not.toHaveBeenCalled()
  })

  it('surfaces OAuth resume failures after normal sign-in success', async () => {
    hoisted.resumeOAuthIfNeeded.mockResolvedValue({
      kind: 'error',
      message: 'OAuth session expired'
    })
    const { authError, onAuthSuccess } = createRedirect()

    await onAuthSuccess()

    expect(authError.value).toBe('OAuth session expired')
    expect(hoisted.toastStore.add).toHaveBeenCalledWith({
      severity: 'success',
      summary: 'Login Completed',
      life: 2000
    })
    expect(hoisted.toastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'oauth.consent.sessionErrorToastSummary',
      detail: 'OAuth session expired',
      life: 4000
    })
    expect(hoisted.router.push).not.toHaveBeenCalled()
    expect(hoisted.router.replace).not.toHaveBeenCalled()
  })

  it('stops after OAuth resume handles the redirect', async () => {
    hoisted.resumeOAuthIfNeeded.mockResolvedValue({ kind: 'resumed' })
    const { defaultRedirect, onAuthSuccess } = createRedirect()

    await onAuthSuccess()

    expect(hoisted.resumeOAuthIfNeeded).toHaveBeenCalledWith(
      hoisted.route.query
    )
    expect(hoisted.router.push).not.toHaveBeenCalled()
    expect(hoisted.router.replace).not.toHaveBeenCalled()
    expect(defaultRedirect).not.toHaveBeenCalled()
  })

  it('redirects to the preserved previous path when there is no OAuth redirect', async () => {
    hoisted.getSafePreviousFullPath.mockReturnValue('/previous?from=login')
    const { defaultRedirect, onAuthSuccess } = createRedirect()

    await onAuthSuccess()

    expect(hoisted.router.replace).toHaveBeenCalledWith('/previous?from=login')
    expect(hoisted.router.push).not.toHaveBeenCalled()
    expect(defaultRedirect).not.toHaveBeenCalled()
  })

  it('uses the default redirect when no desktop, OAuth, or previous-path redirect applies', async () => {
    const { defaultRedirect, onAuthSuccess } = createRedirect()

    await onAuthSuccess()

    expect(defaultRedirect).toHaveBeenCalledOnce()
    expect(hoisted.router.push).toHaveBeenCalledWith({
      name: 'cloud-user-check'
    })
  })
})
