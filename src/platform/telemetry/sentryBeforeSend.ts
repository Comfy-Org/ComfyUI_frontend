import type { ErrorEvent, EventHint } from '@sentry/vue'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'

import { sentryThirdPartyErrorFilter } from './thirdPartyErrorNoise'

/**
 * Groups a `WorkspaceApiError` by what failed rather than where it was
 * caught, so each endpoint and server response gets its own Sentry issue.
 * Errors built outside the HTTP client have no `operation` and keep Sentry's
 * default grouping.
 */
function groupWorkspaceApiError(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent {
  const error = hint.originalException
  if (!(error instanceof WorkspaceApiError)) return event

  const status = error.status === undefined ? 'none' : String(error.status)
  const code = error.code ?? 'none'
  const { operation } = error

  return {
    ...event,
    tags: {
      ...event.tags,
      workspace_api_status: status,
      workspace_api_code: code,
      ...(operation && { workspace_api_operation: operation })
    },
    ...(operation && { fingerprint: [error.name, operation, status, code] })
  }
}

export function sentryBeforeSend(
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent | null {
  const kept = sentryThirdPartyErrorFilter(event, hint)
  return kept && groupWorkspaceApiError(kept, hint)
}
