import type { operations } from '@comfyorg/registry-types'

type CustomerEventsResponse =
  operations['GetCustomerEvents']['responses']['200']['content']['application/json']

/** Badge text of each row: unmapped event types render their raw type. */
export const AGENT_USAGE_EVENT_TYPE = 'agent_usage'
export const PARTNER_NODE_USAGE_EVENT_TYPE = 'Partner Node Usage'

/**
 * `/customers/events` page for the Activity tab's charge tooltip.
 *
 * 33,044 micro-USD is $0.033044, which is 6.97 credits at 211 credits per
 * dollar, so the tooltip reads "Charge: 7 Credits". The second row carries a
 * non-numeric charge, which the tooltip passes through under its raw key.
 */
export const AGENT_USAGE_CUSTOMER_EVENTS = {
  events: [
    {
      event_id: 'evt-agent-usage',
      event_type: 'agent_usage',
      createdAt: '2026-09-20T12:00:00Z',
      params: {
        charge_micro_usd: 33_044,
        input_tokens: 12_480,
        output_tokens: 1_536,
        cached_input_tokens: 4_096
      }
    },
    {
      event_id: 'evt-partner-node-usage',
      event_type: 'api_node_usage',
      createdAt: '2026-09-20T11:00:00Z',
      params: {
        charge_micro_usd: 'pending',
        input_tokens: 320
      }
    }
  ],
  page: 1,
  limit: 7,
  total: 2,
  totalPages: 1
} satisfies CustomerEventsResponse
