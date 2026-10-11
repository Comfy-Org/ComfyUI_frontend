import { fromPartial } from '@total-typescript/shoehorn'
import { FirebaseError } from 'firebase/app'
import { sendEmailVerification } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { EffectScope } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

const mocks = vi.hoisted(() => ({
  flags: { emailVerificationNudgeEnabled: true },
  isCloud: { current: true },
  reportError: vi.fn()
}))

vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    fromPartial<ReturnType<typeof useFeatureFlags>>({ flags: mocks.flags })
}))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mocks.isCloud.current
  }
}))
vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

interface FakeUser {
  emailVerified: boolean
  providerData: { providerId: string }[]
  reload: ReturnType<typeof vi.fn>
  getIdToken: ReturnType<typeof vi.fn>
}

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    emailVerified: false,
    providerData: [{ providerId: 'password' }],
    reload: vi.fn(),
    getIdToken: vi.fn(),
    ...overrides
  }
}

function signIn(user: FakeUser | null) {
  useAuthStore().currentUser = user && fromPartial<User>(user)
}

function toastsOfKind(kind: 'success' | 'error') {
  return useToast().toasts.filter((toast) => toast.kind === kind)
}

let scope: EffectScope | undefined

async function loadComposable() {
  vi.resetModules()
  scope = effectScope()
  const mod = await import('./useEmailVerification')
  return scope.run(() => mod.useEmailVerification())!
}

beforeEach(() => {
  stubFirebaseAuthHarness()
  localStorage.clear()
  mocks.flags.emailVerificationNudgeEnabled = true
  mocks.isCloud.current = true
  vi.mocked(sendEmailVerification).mockReset()
  mocks.reportError.mockReset()
})

afterEach(() => {
  scope?.stop()
  scope = undefined
})

describe('useEmailVerification', () => {
  describe('needsEmailVerification / provider filtering', () => {
    it('flags an unverified password user', async () => {
      signIn(makeUser())
      const { needsEmailVerification, isNudgeVisible } = await loadComposable()
      expect(needsEmailVerification.value).toBe(true)
      expect(isNudgeVisible.value).toBe(true)
    })

    it('ignores SSO (google.com) users', async () => {
      signIn(
        makeUser({
          providerData: [{ providerId: 'google.com' }]
        })
      )
      const { needsEmailVerification, isNudgeVisible } = await loadComposable()
      expect(needsEmailVerification.value).toBe(false)
      expect(isNudgeVisible.value).toBe(false)
    })

    it('ignores an already-verified user', async () => {
      signIn(makeUser({ emailVerified: true }))
      const { needsEmailVerification } = await loadComposable()
      expect(needsEmailVerification.value).toBe(false)
    })

    it('ignores signed-out state', async () => {
      signIn(null)
      const { needsEmailVerification } = await loadComposable()
      expect(needsEmailVerification.value).toBe(false)
    })
  })

  describe('visibility gating', () => {
    it('renders nothing when the feature flag is off', async () => {
      signIn(makeUser())
      mocks.flags.emailVerificationNudgeEnabled = false
      const { isNudgeVisible } = await loadComposable()
      expect(isNudgeVisible.value).toBe(false)
    })

    it('renders nothing outside cloud', async () => {
      signIn(makeUser())
      mocks.isCloud.current = false
      const { isNudgeVisible } = await loadComposable()
      expect(isNudgeVisible.value).toBe(false)
    })
  })

  describe('dismissal', () => {
    it('hides the nudge for the rest of the session and persists it', async () => {
      signIn(makeUser())
      const { isNudgeVisible, dismiss } = await loadComposable()
      expect(isNudgeVisible.value).toBe(true)

      dismiss()

      expect(isNudgeVisible.value).toBe(false)
      expect(
        localStorage.getItem('Comfy.EmailVerificationNudge.DismissedAt')
      ).not.toBeNull()
    })

    it('re-prompts a dismissal from an earlier session', async () => {
      signIn(makeUser())
      localStorage.setItem('Comfy.EmailVerificationNudge.DismissedAt', '1')
      const { isNudgeVisible } = await loadComposable()
      expect(isNudgeVisible.value).toBe(true)
    })

    it('survives storage being blocked (sandboxed iframe / privacy mode)', async () => {
      const getItem = vi
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new DOMException('blocked', 'SecurityError')
        })
      const setItem = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new DOMException('blocked', 'SecurityError')
        })
      signIn(makeUser())

      const { isNudgeVisible, dismiss } = await loadComposable()
      expect(isNudgeVisible.value).toBe(true)

      expect(() => dismiss()).not.toThrow()
      expect(isNudgeVisible.value).toBe(false)

      getItem.mockRestore()
      setItem.mockRestore()
    })
  })

  describe('resend', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('sends a verification email with a continue URL and toasts success', async () => {
      signIn(makeUser())
      vi.mocked(sendEmailVerification).mockResolvedValue(undefined)
      const { resend, canResend } = await loadComposable()

      await resend()

      expect(sendEmailVerification).toHaveBeenCalledWith(
        useAuthStore().currentUser,
        { url: window.location.origin }
      )
      expect(toastsOfKind('success')).toHaveLength(1)
      expect(canResend.value).toBe(false)
    })

    it('maps auth/too-many-requests to a cooldown message', async () => {
      signIn(makeUser())
      vi.mocked(sendEmailVerification).mockRejectedValue(
        new FirebaseError('auth/too-many-requests', 'slow down')
      )
      const { resend } = await loadComposable()

      await resend()

      expect(toastsOfKind('error')).toEqual([
        expect.objectContaining({
          description:
            'Too many requests. Please wait a moment before trying again.'
        })
      ])
    })

    it('shows a generic error for other failures', async () => {
      signIn(makeUser())
      vi.mocked(sendEmailVerification).mockRejectedValue(new Error('network'))
      const { resend } = await loadComposable()

      await resend()

      expect(toastsOfKind('error')).toEqual([
        expect.objectContaining({
          description: 'Something went wrong. Please try again in a moment.'
        })
      ])
    })

    it('re-enables the button immediately after a non-rate-limit failure', async () => {
      signIn(makeUser())
      vi.mocked(sendEmailVerification).mockRejectedValue(new Error('network'))
      const { resend, canResend } = await loadComposable()

      await resend()

      expect(canResend.value).toBe(true)
    })

    it('keeps the button disabled after a rate-limit failure', async () => {
      signIn(makeUser())
      vi.mocked(sendEmailVerification).mockRejectedValue(
        new FirebaseError('auth/too-many-requests', 'slow down')
      )
      const { resend, canResend } = await loadComposable()

      await resend()

      expect(canResend.value).toBe(false)
    })

    it('does not show an error toast when a post-send refresh fails', async () => {
      signIn(
        makeUser({
          reload: vi.fn().mockRejectedValue(new Error('offline'))
        })
      )
      vi.mocked(sendEmailVerification).mockResolvedValue(undefined)
      const { resend } = await loadComposable()

      await resend()

      expect(toastsOfKind('success')).toHaveLength(1)
      expect(toastsOfKind('error')).toEqual([])
    })

    it('re-enables the button after the cooldown elapses', async () => {
      signIn(makeUser())
      vi.mocked(sendEmailVerification).mockResolvedValue(undefined)
      const { resend, canResend } = await loadComposable()

      await resend()
      expect(canResend.value).toBe(false)

      await vi.advanceTimersByTimeAsync(60_000)
      expect(canResend.value).toBe(true)
    })
  })

  describe('refresh', () => {
    it('hides the nudge once verification flips and refreshes the token', async () => {
      const user = makeUser({
        reload: vi.fn().mockImplementation(() => {
          user.emailVerified = true
        })
      })
      signIn(user)
      const { needsEmailVerification, refresh } = await loadComposable()
      expect(needsEmailVerification.value).toBe(true)

      await refresh()

      expect(user.reload).toHaveBeenCalled()
      expect(user.getIdToken).toHaveBeenCalledWith(true)
      expect(needsEmailVerification.value).toBe(false)
    })

    it('picks up a verification done in another tab on window focus, even after dismissal', async () => {
      const user = makeUser({
        reload: vi.fn().mockImplementation(() => {
          user.emailVerified = true
        })
      })
      signIn(user)
      const { needsEmailVerification, dismiss } = await loadComposable()
      dismiss()

      window.dispatchEvent(new Event('focus'))

      await vi.waitFor(() => expect(needsEmailVerification.value).toBe(false))
      expect(user.getIdToken).toHaveBeenCalledWith(true)
    })

    it('does not reload the user on focus while the feature is disabled', async () => {
      const user = makeUser()
      signIn(user)
      mocks.flags.emailVerificationNudgeEnabled = false
      await loadComposable()

      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()

      expect(user.reload).not.toHaveBeenCalled()
    })

    it('reports a reload failure to telemetry instead of surfacing it', async () => {
      const reloadFailure = new Error('offline')
      signIn(
        makeUser({
          reload: vi.fn().mockRejectedValue(reloadFailure)
        })
      )
      const { refresh } = await loadComposable()

      await expect(refresh()).resolves.toBeUndefined()

      expect(mocks.reportError).toHaveBeenCalledWith(reloadFailure, {
        errorType: 'email_verification_refresh_failure',
        surface: 'auth'
      })
    })

    it('collapses overlapping refreshes into a single reload', async () => {
      let finishReload = () => {}
      const user = makeUser({
        reload: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              finishReload = resolve
            })
        )
      })
      signIn(user)
      const { refresh } = await loadComposable()

      const first = refresh()
      const second = refresh()
      finishReload()
      await Promise.all([first, second])

      expect(user.reload).toHaveBeenCalledOnce()
    })
  })
})
