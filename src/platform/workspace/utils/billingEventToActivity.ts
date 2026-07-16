import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'

/**
 * Maps a `/api/billing/events` usage row to an Activity ledger row (FE-1249).
 *
 * Only the fields the backend exposes today are populated: the date, the member
 * the event is attributed to (`params.user_id`), and the event type. The Credits
 * column stays 0 until per-event cost lands (FE-1249 / P1), and `partnerNode` is
 * best-effort from `params` because the partner (comfy-api) property contract is
 * not yet fixed.
 */

export interface BillingEventInput {
  event_type: string
  event_id: string
  params?: Record<string, unknown>
  createdAt: string
}

export interface ActivityEventTypeLabels {
  cloudRun: string
  partnerNode: string
}

const USAGE_EVENT_TYPES = new Set(['gpu_usage', 'api_node_usage'])

export function isUsageEvent(event: BillingEventInput): boolean {
  return USAGE_EVENT_TYPES.has(event.event_type)
}

function stringParam(
  params: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = params?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function billingEventToActivity(
  event: BillingEventInput,
  resolveUserName: (userId: string | undefined) => string,
  labels: ActivityEventTypeLabels
): ActivityEvent {
  const isPartner = event.event_type === 'api_node_usage'
  return {
    id: event.event_id,
    date: new Date(event.createdAt),
    userName: resolveUserName(stringParam(event.params, 'user_id')),
    eventType: isPartner ? labels.partnerNode : labels.cloudRun,
    detail: '',
    credits: 0,
    partnerNode: isPartner
      ? stringParam(event.params, 'partner_node')
      : undefined,
    credited: false
  }
}
