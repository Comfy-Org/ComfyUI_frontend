import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { cloudSignIn } from '@/platform/auth/session/cloudIdentityBoot'
import { createAppRouter } from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { reportError } from '@comfyorg/telemetry/reportError'

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@/platform/auth/session/cloudIdentityBoot'), () => ({
  cloudSignIn: vi.fn()
}))

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@comfyorg/telemetry/reportError'))

vi.mock(import('firebase/auth'))

const storageBlocked = () =>
  new DOMException('Access is denied for this document.', 'SecurityError')

function failSignInCheck(isLoggedIn: boolean): DOMException {
  const error = storageBlocked()
  vi.mocked(cloudSignIn).mockRejectedValue(error)
  vi.mocked(useCurrentUser).mockReturnValue({
    ...useCurrentUser(),
    isLoggedIn: computed(() => isLoggedIn)
  })
  useAuthStore().isInitialized = true
  return error
}

describe('cloud sign-in guard', () => {
  it.for(['/', '/cloud/login'])(
    'lands %s on sign-in when the sign-in check throws',
    async (path) => {
      const error = failSignInCheck(false)
      const router = await createAppRouter()

      await router.push(path)

      expect(router.currentRoute.value.name).toBe('cloud-login')
      expect(reportError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ errorType: 'cloud_sign_in_check_failed' })
      )
    }
  )

  it('lets a still signed-in user through when the sign-in check throws', async () => {
    failSignInCheck(true)
    const router = await createAppRouter()

    await router.push('/cloud/user-check')

    expect(router.currentRoute.value.name).toBe('cloud-user-check')
  })
})
