import type { MaybeRefOrGetter } from 'vue'

import { useExperimentVariant } from '@/platform/experiments/useExperimentVariant'
import type { AgentFreeUsePlacement } from '@/platform/telemetry/types'

/** PostHog multivariate flag backing DES-1221 / FE-3142. */
const FREE_USE_PLACEMENT_FLAG = 'agent-free-use-message-placement'

export const FREE_USE_PLACEMENTS = [
  'control',
  'top-banner',
  'near-composer',
  'above-input',
  'inside-input'
] as const satisfies readonly ['control', ...AgentFreeUsePlacement[]]

export type FreeUseVariant = (typeof FREE_USE_PLACEMENTS)[number]

export function isFreeUsePlacement(
  variant: FreeUseVariant
): variant is AgentFreeUsePlacement {
  return variant !== 'control'
}

/**
 * The viewer's free-use-notice placement for the DES-1221 experiment.
 *
 * Every arm shows the same panel with the same starter prompts and the same
 * composer placeholder; only where the notice sits changes, so placement is
 * the isolated variable.
 *
 * `eligible` must be the agent panel actually being on screen for this viewer.
 * Reading the flag is what records the exposure, so a viewer who can never see
 * the panel must never reach it — otherwise the experiment's denominator is
 * the whole population rather than panel openers, which is the group the
 * hypothesis is about.
 */
export function useFreeUsePlacement(eligible: MaybeRefOrGetter<boolean>) {
  return useExperimentVariant<FreeUseVariant>({
    flagKey: FREE_USE_PLACEMENT_FLAG,
    variants: FREE_USE_PLACEMENTS,
    control: 'control',
    eligible
  })
}
