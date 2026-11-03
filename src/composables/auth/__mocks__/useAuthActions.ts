import { onTestFinished, vi } from 'vitest'
import { ref } from 'vue'

import type { useAuthActions as realUseAuthActions } from '@/composables/auth/useAuthActions'

const actions: ReturnType<typeof realUseAuthActions> = {
  logout: vi.fn(async () => undefined),
  sendPasswordReset: vi.fn(async () => true),
  signInWithGoogle: vi.fn(async () => undefined),
  signInWithGithub: vi.fn(async () => undefined),
  signInWithEmail: vi.fn(async () => undefined),
  signUpWithEmail: vi.fn(async () => undefined),
  reportError: vi.fn(),
  accessError: ref(false)
}

export const useAuthActions = vi.fn<typeof realUseAuthActions>(() => {
  onTestFinished(() => {
    actions.accessError.value = false
  })
  return actions
})
