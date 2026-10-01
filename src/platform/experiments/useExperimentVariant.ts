import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

import { readExperimentVariant } from './postHogExperimentClient'

interface ExperimentOptions<V extends string> {
  /** PostHog multivariate flag key, e.g. `agent-free-use-message-placement`. */
  flagKey: string
  /** Every variant the experiment ships, including the control. */
  variants: readonly V[]
  /** The variant used before, instead of, and on any failure of assignment. */
  control: V
  /**
   * Whether this viewer is in the population under test. The flag is read on
   * the first `true` and never before, so an ineligible viewer records no
   * exposure.
   */
  eligible: MaybeRefOrGetter<boolean>
}

interface Experiment<V extends string> {
  variant: Readonly<Ref<V>>
}

/**
 * Binds a PostHog multivariate flag to a reactive variant, gated on
 * eligibility.
 *
 * Assignment is read at most once per caller and then held, so a viewer whose
 * eligibility flickers — closing and reopening a panel, say — keeps the
 * placement they were already shown. Across page loads, stability comes from
 * PostHog hashing the distinct id, which is the existing model; nothing here
 * re-rolls it.
 *
 * Anything other than a known variant resolves to the control: an unreachable
 * PostHog, a flag that is off, and a variant added server-side ahead of the
 * client all mean "this viewer sees the untreated experience".
 */
export function useExperimentVariant<V extends string>({
  flagKey,
  variants,
  control,
  eligible
}: ExperimentOptions<V>): Experiment<V> {
  const assigned = ref<V>()
  const variant = computed(() => assigned.value ?? control)

  function isVariant(value: string | undefined): value is V {
    return variants.some((variant) => variant === value)
  }

  let read = false
  watch(
    () => toValue(eligible),
    (isEligible) => {
      if (!isEligible || read) return
      read = true
      void readExperimentVariant(flagKey)
        .then((value) => {
          if (isVariant(value)) assigned.value = value
        })
        .catch((error: unknown) => {
          reportError(error, {
            surface: 'platform',
            errorType: 'experiment_assignment_failed',
            tags: { flag_key: flagKey },
            level: 'warning'
          })
        })
    },
    { immediate: true }
  )

  return { variant }
}
