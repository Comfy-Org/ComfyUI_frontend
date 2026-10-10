import type {
  BillingStatusResponse,
  RetentionFlowResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

export const CANCELLATION_SURVEY_REMOTE_CONFIG: RemoteConfig = {
  cancellation_survey_id: 'survey-e2e'
}

export const PERSONAL_PRO_BILLING_STATUS = {
  billing_rail: 'stripe',
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  plan_slug: 'pro-monthly',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  team_credit_stop: null,
  scheduled_change: null,
  max_seats: 1,
  occupied_seats: 1
} satisfies BillingStatusResponse

const subscription: RetentionFlowResponse['subscription'] = {
  currency: 'usd',
  unit_amount: 10_000,
  quantity: 1,
  period_end: Date.UTC(2099, 1, 20) / 1000
}

export const OFFER_ARM_FLOW: RetentionFlowResponse = {
  session_id: '00000000-0000-4000-8000-0000000000e2',
  expires_at: Date.UTC(2099, 0, 1) / 1000,
  experiment_variant: 'save_30_next_3_v1',
  offer: { id: 'save_30_next_3_v1', percent_off: 30, duration_in_months: 3 },
  subscription
}

export const CONTROL_ARM_FLOW: RetentionFlowResponse = {
  session_id: '00000000-0000-4000-8000-0000000000e3',
  expires_at: Date.UTC(2099, 0, 1) / 1000,
  experiment_variant: 'control',
  subscription
}
