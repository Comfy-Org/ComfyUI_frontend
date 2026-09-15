import { vi } from 'vitest'
import { ref } from 'vue'

import type { useAuthActions as realUseAuthActions } from '../useAuthActions'

type AuthActions = ReturnType<typeof realUseAuthActions>

const actions: Omit<AuthActions, 'accessError'> = {
  logout: vi.fn(async () => undefined),
  sendPasswordReset: vi.fn(async () => true),
  purchaseCredits: vi.fn(async () => undefined),
  purchaseCreditsDirect: vi.fn(async () => undefined),
  accessBillingPortal: vi.fn(async () => true),
  fetchBalance: vi.fn(async () => null),
  signInWithGoogle: vi.fn(async () => undefined),
  signInWithGithub: vi.fn(async () => undefined),
  signInWithEmail: vi.fn(async () => undefined),
  signUpWithEmail: vi.fn(async () => undefined),
  updatePassword: vi.fn(async () => undefined),
  reportError: vi.fn()
}

export const useAuthActions = vi.fn<typeof realUseAuthActions>(
  (): AuthActions => ({
    ...actions,
    accessError: ref(false)
  })
)
