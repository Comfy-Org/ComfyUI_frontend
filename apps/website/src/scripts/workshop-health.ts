import type { WorkshopAnalyticsEvent } from './workshop-analytics'

type ServiceHealth = 'success' | 'failure' | 'excluded' | 'pending'

type FailedRun = Extract<
  Extract<WorkshopAnalyticsEvent, { name: 'run_finished' }>['properties'],
  { status: 'failed' }
>

function isAccountRefusal(failure: FailedRun): boolean {
  if (failure.reason !== 'unavailable') return false
  return (
    failure.failure_stage === 'credential' ||
    [401, 403].includes(failure.http_status ?? 0) ||
    ['forbidden', 'not_enabled'].includes(failure.router_error_type ?? '')
  )
}

function isActionableInputIssue(failure: FailedRun): boolean {
  if (
    [failure.request_id, failure.http_status, failure.router_error_type].some(
      (value) => value !== undefined
    )
  )
    return false
  const names = failure.field_error_names
  const codes = failure.field_error_codes
  if (!names?.length || !codes?.length) return false
  if (failure.reason === 'validation') return true
  return (
    failure.reason === 'client' &&
    codes.every((code) => ['fileUnreadable', 'videoUnreadable'].includes(code))
  )
}

function isExcludedFailure(failure: FailedRun): boolean {
  return [
    isAccountRefusal(failure),
    isActionableInputIssue(failure),
    ['noCredits', 'policy', 'concurrency'].includes(failure.reason)
  ].includes(true)
}

function health(event: WorkshopAnalyticsEvent): ServiceHealth {
  if (event.name === 'delivery_finished') {
    if (event.properties.status === 'succeeded') return 'success'
    return event.properties.status === 'failed' ? 'failure' : 'excluded'
  }
  if (event.name !== 'run_finished') return 'excluded'
  if (event.properties.status === 'succeeded') return 'pending'
  if (event.properties.status === 'cancelled') return 'excluded'
  return isExcludedFailure(event.properties) ? 'excluded' : 'failure'
}

function failureType(event: WorkshopAnalyticsEvent): string | undefined {
  if (event.name === 'run_validation_failed') return 'validation'
  if (event.name === 'delivery_finished') {
    if (event.properties.status !== 'failed') return
    return event.properties.reason ?? 'delivery_error'
  }
  if (event.name !== 'run_finished' || event.properties.status !== 'failed')
    return
  return (
    event.properties.router_error_type ??
    event.properties.exception_name ??
    event.properties.reason
  )
}

const HEALTH_FIELDS = new Set([
  'model_slug',
  'router_id',
  'provider',
  'modality',
  'request_id',
  'duration_ms',
  'reason',
  'failure_stage',
  'http_status',
  'router_error_type',
  'field_error_codes',
  'field_error_names',
  'exception_name',
  'exception_frames',
  'output_count',
  'output_kind'
])

export function workshopHealthLog(event: WorkshopAnalyticsEvent) {
  if (
    event.name !== 'run_started' &&
    event.name !== 'run_finished' &&
    event.name !== 'delivery_finished' &&
    event.name !== 'run_validation_failed'
  )
    return
  const properties = event.properties
  const type = failureType(event)
  return {
    ...Object.fromEntries(
      Object.entries(properties).filter(([key]) => HEALTH_FIELDS.has(key))
    ),
    feature: 'models',
    telemetry_version: 1,
    event_name: event.name,
    service_health: health(event),
    ...('reason' in properties && properties.reason
      ? { reason: properties.reason }
      : {}),
    ...(type ? { failure_type: type } : {}),
    ...('attempt_id' in properties
      ? { client_attempt_id: properties.attempt_id }
      : {}),
    ...('status' in properties ? { outcome: properties.status } : {})
  }
}

export type WorkshopHealthLog = NonNullable<
  ReturnType<typeof workshopHealthLog>
>
