import type { ReportErrorOptions } from '@comfyorg/telemetry/reportError'

import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

/** Returns Sentry routing options for an authentication-denied billing read. */
export function sessionEndedReporting(
  error: unknown
): Pick<ReportErrorOptions, 'sentryMode'> {
  const sessionEnded =
    error instanceof WorkspaceApiError &&
    (error.status === 401 || error.code === 'NOT_AUTHENTICATED')
  return sessionEnded ? { sentryMode: 'never' } : {}
}
