import { vi } from 'vitest'

import type { useSubscriptionDialog as realUseSubscriptionDialog } from '../useSubscriptionDialog'

const subscriptionDialog: ReturnType<typeof realUseSubscriptionDialog> = {
  show: vi.fn(),
  showPricingTable: vi.fn(),
  hide: vi.fn(),
  startTeamWorkspaceUpgradeFlow: vi.fn(),
  resumePendingPricingFlow: vi.fn(async () => {})
}

export const useSubscriptionDialog = vi.fn(() => subscriptionDialog)
