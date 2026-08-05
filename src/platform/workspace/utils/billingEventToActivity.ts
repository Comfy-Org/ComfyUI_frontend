import type { BillingEvent } from '@/platform/workspace/api/workspaceApi'
import type { ActivityEvent } from '@/platform/workspace/composables/useWorkspaceActivity'

export interface ActivityEventTypeLabels {
  cloudRun: string
  partnerNode: string
}

const USAGE_EVENT_TYPES = new Set(['gpu_usage', 'api_node_usage'])

export function isUsageEvent(event: BillingEvent): boolean {
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
  event: BillingEvent,
  resolveUserName: (userId: string | undefined) => string,
  labels: ActivityEventTypeLabels
): ActivityEvent {
  const userId = stringParam(event.params, 'user_id')
  const isPartnerNode = event.event_type === 'api_node_usage'
  return {
    id: event.event_id,
    date: new Date(event.createdAt),
    userId: userId ?? null,
    userName: resolveUserName(userId),
    eventType: isPartnerNode ? labels.partnerNode : labels.cloudRun,
    detail: '',
    credits: 0,
    partnerNode: isPartnerNode
      ? stringParam(event.params, 'partner_node')
      : undefined,
    credited: false
  }
}
