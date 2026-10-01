import { isCloud } from '@/platform/distribution/types'

/**
 * Resolves a PostHog multivariate flag once PostHog has loaded its flags for
 * the current person.
 *
 * `posthog-js` exports a singleton, so this reads the same instance
 * `PostHogTelemetryProvider` initialises. Flags are not available
 * synchronously at boot, hence `onFeatureFlags` — it fires immediately when
 * they have already landed and on the next load otherwise.
 *
 * **Calling this records the experiment exposure** (`$feature_flag_called`).
 * Resolve a flag only for people who are eligible for the experiment, or the
 * denominator stops being the population under test.
 *
 * Non-cloud builds never reach PostHog, so they resolve to `undefined` without
 * pulling the chunk in. A boolean flag value also resolves to `undefined`:
 * this is the multivariate reader, and a boolean carries no variant.
 */
export async function readExperimentVariant(
  flagKey: string
): Promise<string | undefined> {
  if (!isCloud) return undefined
  const { default: posthog } = await import('posthog-js')
  await new Promise<void>((resolve) => {
    posthog.onFeatureFlags(() => resolve())
  })
  const value = posthog.getFeatureFlag(flagKey)
  return typeof value === 'string' ? value : undefined
}
