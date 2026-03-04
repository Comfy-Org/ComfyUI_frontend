import type { Ref } from 'vue'

import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'

import { useAppSetDefaultView } from './useAppSetDefaultView'

export const BUILDER_STEPS = [
  'builder:select',
  'builder:arrange',
  'setDefaultView'
] as const

export type BuilderStepId = (typeof BUILDER_STEPS)[number]

const ARRANGE_INDEX = BUILDER_STEPS.indexOf('builder:arrange')

export function useBuilderSteps(options?: { hasOutputs?: Ref<boolean> }) {
  const { mode, isBuilderMode } = useAppMode()
  const { settingView } = useAppSetDefaultView()

  const activeStep = computed<BuilderStepId>(() => {
    if (settingView.value) return 'setDefaultView'
    if (isBuilderMode.value) {
      return mode.value as BuilderStepId
    }
    return 'builder:select'
  })

  const activeStepIndex = computed(() =>
    BUILDER_STEPS.indexOf(activeStep.value)
  )

  const isFirstStep = computed(() => activeStepIndex.value === 0)

  const isLastStep = computed(() => {
    if (!options?.hasOutputs?.value)
      return activeStepIndex.value >= ARRANGE_INDEX
    return activeStepIndex.value >= BUILDER_STEPS.length - 1
  })

  return { activeStep, activeStepIndex, isFirstStep, isLastStep }
}
