import type { PostHog } from 'posthog-js'

import { isCloud } from '@/platform/distribution/types'

const assignments = new Map<string, Promise<string | undefined>>()
let posthogPromise: Promise<PostHog> | undefined

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
  const posthog = await (posthogPromise ??= import('posthog-js').then(
    ({ default: posthog }) => posthog
  ))
  const assignmentKey = `${posthog.get_distinct_id()}:${flagKey}`
  const existing = assignments.get(assignmentKey)
  if (existing) return existing

  const assignment = loadExperimentVariant(posthog, flagKey).catch(
    (error: unknown) => {
      if (assignments.get(assignmentKey) === assignment) {
        assignments.delete(assignmentKey)
      }
      throw error
    }
  )
  assignments.set(assignmentKey, assignment)
  return assignment
}

async function loadExperimentVariant(
  posthog: PostHog,
  flagKey: string
): Promise<string | undefined> {
  let unsubscribe = (): void => {}
  await new Promise<void>((resolve) => {
    unsubscribe = posthog.onFeatureFlags(() => resolve())
  })
  unsubscribe()
  const value = posthog.getFeatureFlag(flagKey)
  return typeof value === 'string' ? value : undefined
}
