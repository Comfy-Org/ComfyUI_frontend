import type { ReportErrorOptions } from '@comfyorg/telemetry/reportError'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

/**
 * A billing read refused because the session ended (signed out, expired or
 * revoked) is an expected denial: it stays in Datadog and out of Sentry.
 */
export function sessionEndedReporting(
  error: unknown
): Pick<ReportErrorOptions, 'sentryMode'> {
  const sessionEnded =
    error instanceof WorkspaceApiError &&
    (error.status === 401 || error.code === 'NOT_AUTHENTICATED')
  return sessionEnded ? { sentryMode: 'never' } : {}
}
