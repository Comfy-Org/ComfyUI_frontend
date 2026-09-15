import { vi } from 'vitest'
import { ref } from 'vue'

import type { useAuthActions as realUseAuthActions } from '../useAuthActions'

type AuthActions = ReturnType<typeof realUseAuthActions>

export const useAuthActions = vi.fn<typeof realUseAuthActions>(
  (): AuthActions => ({
    logout: vi.fn<AuthActions['logout']>(async () => undefined),
    sendPasswordReset: vi.fn<AuthActions['sendPasswordReset']>(
      async () => true
    ),
    purchaseCredits: vi.fn<AuthActions['purchaseCredits']>(
      async () => undefined
    ),
    purchaseCreditsDirect: vi.fn<AuthActions['purchaseCreditsDirect']>(
      async () => undefined
    ),
    accessBillingPortal: vi.fn<AuthActions['accessBillingPortal']>(
      async () => true
    ),
    fetchBalance: vi.fn<AuthActions['fetchBalance']>(async () => null),
    signInWithGoogle: vi.fn<AuthActions['signInWithGoogle']>(
      async () => undefined
    ),
    signInWithGithub: vi.fn<AuthActions['signInWithGithub']>(
      async () => undefined
    ),
    signInWithEmail: vi.fn<AuthActions['signInWithEmail']>(
      async () => undefined
    ),
    signUpWithEmail: vi.fn<AuthActions['signUpWithEmail']>(
      async () => undefined
    ),
    updatePassword: vi.fn<AuthActions['updatePassword']>(async () => undefined),
    accessError: ref(false),
    reportError: vi.fn<AuthActions['reportError']>()
  })
)
