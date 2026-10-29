import { describe, expect, it, vi } from 'vitest'

import { cloudSignIn } from '@/platform/auth/session/cloudIdentityBoot'
import { createAppRouter } from '@/router'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@/platform/auth/session/cloudIdentityBoot'), () => ({
  cloudSignIn: vi.fn()
}))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('firebase/auth'))

const storageBlocked = () =>
  new DOMException('Access is denied for this document.', 'SecurityError')

describe('cloud sign-in guard', () => {
  it.for(['/', '/cloud/login'])(
    'lands %s on sign-in when the sign-in check throws',
    async (path) => {
      const error = storageBlocked()
      vi.mocked(cloudSignIn).mockRejectedValue(error)
      useAuthStore().isInitialized = true
      const router = await createAppRouter()

      await router.push(path)

      expect(router.currentRoute.value.name).toBe('cloud-login')
      expect(console.error).toHaveBeenCalledWith(
        'Cloud sign-in check failed:',
        error
      )
    }
  )
})
