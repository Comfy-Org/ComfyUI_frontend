import type { operations } from '@comfyorg/registry-types'

type CustomerEventsResponse =
  operations['GetCustomerEvents']['responses']['200']['content']['application/json']

/** Badge text the Activity table renders for each mocked event. */
export const AGENT_USAGE_EVENT_TYPE = 'Agent Usage'
export const PARTNER_NODE_USAGE_EVENT_TYPE = 'Partner Node Usage'

/** `/customers/events` page with a numeric and a non-numeric `charge_micro_usd`. */
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
