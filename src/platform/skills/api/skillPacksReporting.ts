import type { ReportErrorOptions } from '@comfyorg/telemetry/reportError'

import { SkillPacksApiError } from '@/platform/skills/api/skillsApi'

/** Returns Sentry routing options for a session-denied skill-pack call. */
export function skillPacksReporting(
  error: unknown
): Pick<ReportErrorOptions, 'sentryMode'> {
  return error instanceof SkillPacksApiError && error.status === 401
    ? { sentryMode: 'never' }
    : {}
}
