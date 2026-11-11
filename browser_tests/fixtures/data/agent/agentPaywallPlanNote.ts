import type { BillingStatusResponse } from '@comfyorg/ingest-types'

import { zAgentAdmissionError } from '@/workbench/extensions/agent/schemas/agentApiSchema'

export const AGENT_NO_FUNDS_ERROR = zAgentAdmissionError.parse({
  error: {
    message:
      'This workspace is out of funds. Add credits or subscribe to keep going.',
    reason: 'no_funds',
    type: 'PAYMENT_REQUIRED'
  }
})

export const NEVER_SUBSCRIBED_BILLING_STATUS = {
  billing_rail: 'stripe',
  billing_status: 'inactive',
  has_funds: false,
  is_active: false,
  max_seats: 1,
  occupied_seats: 1,
  scoped_effective_has_funds: { agent: false },
  scoped_has_funds: { agent: false },
  scheduled_change: null,
  next_charge: null,
  subscription_state: 'never_subscribed',
  subscription_tier: 'FREE',
  ended_at: null,
  team_credit_stop: null
} satisfies BillingStatusResponse
