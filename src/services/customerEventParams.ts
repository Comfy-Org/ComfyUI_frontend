import type { components } from '@/types/comfyRegistryTypes'

import type { EventType } from './customerEventsService'

type AuditLog = components['schemas']['AuditLog']

const TOOLTIP_PARAM_ALLOWLIST = [
  'credits_used',
  'amount',
  'model',
  'api_name',
  'endpoint',
  'subscription_id',
  'gpu_seconds',
  'duration'
] as const

type TooltipParamKey = (typeof TOOLTIP_PARAM_ALLOWLIST)[number]

const DETAILS_COLUMN_PARAM_KEYS: Partial<
  Record<string, readonly TooltipParamKey[]>
> = {
  ['credit_added' satisfies `${EventType}`]: ['amount'],
  ['api_usage_completed' satisfies `${EventType}`]: ['api_name', 'model']
}

export function presentTooltipParamKeys(params: Record<string, unknown>) {
  return TOOLTIP_PARAM_ALLOWLIST.filter(
    (key) => params[key] != null && params[key] !== ''
  )
}

export function hasParamsBeyondDetailsColumn(event: AuditLog) {
  const shownInDetails = DETAILS_COLUMN_PARAM_KEYS[event.event_type ?? ''] ?? []
  return presentTooltipParamKeys(event.params || {}).some(
    (key) => !shownInDetails.includes(key)
  )
}
