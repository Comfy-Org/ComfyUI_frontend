import { computed, ref } from 'vue'

import { readExperimentVariant } from '@/platform/experiments/postHogExperimentClient'
import { reportError } from '@/platform/telemetry/reportError'
import type { AgentFreeUsePlacement } from '@/platform/telemetry/types'

const FREE_USE_PLACEMENT_FLAG = 'agent-free-use-message-placement'

export const FREE_USE_PLACEMENTS = [
  'control',
  'top-banner',
  'near-composer',
  'above-input',
  'inside-input'
] as const satisfies readonly ['control', ...AgentFreeUsePlacement[]]

export type FreeUseVariant = (typeof FREE_USE_PLACEMENTS)[number]

function isFreeUseVariant(value: string | undefined): value is FreeUseVariant {
  return FREE_USE_PLACEMENTS.some((variant) => variant === value)
}

export function useFreeUsePlacement() {
  const assigned = ref<FreeUseVariant>()
  const variant = computed(() => assigned.value ?? 'control')

  void readExperimentVariant(FREE_USE_PLACEMENT_FLAG)
    .then((value) => {
      if (isFreeUseVariant(value)) assigned.value = value
    })
    .catch((error: unknown) => {
      reportError(error, {
        surface: 'platform',
        errorType: 'experiment_assignment_failed',
        tags: { flag_key: FREE_USE_PLACEMENT_FLAG },
        level: 'warning'
      })
    })

  return { variant }
}
