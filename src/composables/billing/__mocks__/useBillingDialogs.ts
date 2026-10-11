import { vi } from 'vitest'

import type { useBillingDialogs as realUseBillingDialogs } from '../useBillingDialogs'

type BillingDialogs = ReturnType<typeof realUseBillingDialogs>

const dialog: ReturnType<BillingDialogs['showBillingComingSoonDialog']> = {
  key: 'test-dialog',
  visible: true,
  component: {},
  contentProps: {},
  dialogComponentProps: {},
  priority: 1
}

const billingDialogs = vi.mockObject<BillingDialogs>(
  {
    showTopUpCreditsDialog: async () => undefined,
    showSubscriptionRequiredDialog: async () => {},
    showBillingComingSoonDialog: () => dialog,
    showCancelSubscriptionDialog: async () => dialog,
    showCancelSubscriptionFlow: async () => {},
    showDowngradeToPersonalDialog: async () => null
  },
  { spy: true }
)

export const useBillingDialogs = vi.fn(() => billingDialogs)
