import type { TopupCommand } from '@comfyorg/account-core/billing'
import { vi } from 'vitest'

import type * as realBillingSdk from '../workshop-billing-sdk'

const command = vi.mockObject<TopupCommand>(
  {
    createHostedTopupCheckout: async () => ({
      status: 'error',
      code: 'NOT_AVAILABLE'
    }),
    createTopupCheckout: async () => ({
      status: 'error',
      code: 'NOT_AVAILABLE'
    })
  },
  { spy: true }
)

const billingSdk: typeof realBillingSdk = {
  workshopTopupCommand: vi.fn(() => command)
}

export const { workshopTopupCommand } = billingSdk
