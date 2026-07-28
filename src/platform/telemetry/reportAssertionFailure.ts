import { datadogRum } from '@datadog/browser-rum'

/**
 * Reports an `assert()` failure (see `@/base/assert`) to Datadog RUM as an
 * error, so internal invariant violations are visible in Comfy Cloud's RUM
 * error stream instead of only living in the browser console.
 *
 * No-op when RUM hasn't been initialized for this session — e.g. the
 * hostname isn't a recognized Comfy Cloud environment (see
 * `initDatadogRum.ts`), so this stays inert on self-hosted/OSS/desktop
 * usage and local development.
 */
export function reportAssertionFailureToDatadog(message: string): void {
  if (!datadogRum.getInitConfiguration()) return

  datadogRum.addError(new Error(message), { source: 'assert' })
}
