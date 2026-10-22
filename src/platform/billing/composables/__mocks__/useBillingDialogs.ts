import { vi } from 'vitest'

import { provideBillingDialogs } from '@/platform/billing/subscription/composables/billingDialogsAccess'

import type { useBillingDialogs as realUseBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

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

provideBillingDialogs(useBillingDialogs)
