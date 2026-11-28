import type { ReportErrorOptions } from '@comfyorg/telemetry/reportError'

import {
  isLoopbackOnlyRefusal,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'

/**
 * Keeps expected refusals (an ended session, the local host's loopback-only
 * fence) out of Sentry; Datadog still counts them.
 */
export function skillPacksReporting(
  error: unknown
): Pick<ReportErrorOptions, 'sentryMode'> {
  const expected =
    (error instanceof SkillPacksApiError && error.status === 401) ||
    isLoopbackOnlyRefusal(error)
  return expected ? { sentryMode: 'never' } : {}
}
