import { vi } from 'vitest'

import { provideSubscriptionDialog } from '@/platform/billing/subscription/composables/subscriptionDialogAccess'

import type { useSubscriptionDialog as realUseSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'

const subscriptionDialog: ReturnType<typeof realUseSubscriptionDialog> = {
  show: vi.fn(async () => true),
  showPricingTable: vi.fn(async () => true),
  hide: vi.fn(),
  startTeamWorkspaceUpgradeFlow: vi.fn(),
  resumePendingPricingFlow: vi.fn(async () => {})
}

export const useSubscriptionDialog = vi.fn(() => subscriptionDialog)

provideSubscriptionDialog(useSubscriptionDialog)
