import { vi } from 'vitest'

import type { useSubscriptionPaywall as realUseSubscriptionPaywall } from '../useSubscriptionPaywall'

const paywall = vi.mockObject<ReturnType<typeof realUseSubscriptionPaywall>>(
  { showSubscriptionDialog: () => {} },
  { spy: true }
)

export const useSubscriptionPaywall = vi.fn(() => paywall)
