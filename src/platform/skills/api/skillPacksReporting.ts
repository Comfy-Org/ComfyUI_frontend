import type { ReportErrorOptions } from '@comfyorg/telemetry/reportError'

import { SkillPacksApiError } from '@/platform/skills/api/skillsApi'

/**
 * A 401 means the session ended or is not established yet (e.g. on the login
 * page); sign-in owns recovery, so it goes to Datadog only, not Sentry.
 */
export function skillPacksReporting(
  error: unknown
): Pick<ReportErrorOptions, 'sentryMode'> {
  return error instanceof SkillPacksApiError && error.status === 401
    ? { sentryMode: 'never' }
    : {}
}
