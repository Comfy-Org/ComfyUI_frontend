import type { Ref } from 'vue'

import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import type { BuilderTarget } from '@/utils/appMode'

const APP_BUILDER_STEPS = [
  'builder:inputs',
  'builder:outputs',
  'builder:arrange'
] as const

const API_BUILDER_STEPS = ['builder:inputs', 'builder:outputs'] as const

export type BuilderStepId = (typeof APP_BUILDER_STEPS)[number]

export function builderStepsForTarget(
  target: BuilderTarget
): readonly BuilderStepId[] {
  return target === 'api' ? API_BUILDER_STEPS : APP_BUILDER_STEPS
}

export function useBuilderSteps(options?: { hasOutputs?: Ref<boolean> }) {
  const { mode, isBuilderMode, setMode } = useAppMode()
  const { builderTarget } = storeToRefs(useAppModeStore())

  const steps = computed(() => builderStepsForTarget(builderTarget.value))

  const activeStep = computed<BuilderStepId>(() => {
    if (isBuilderMode.value) {
      return mode.value as BuilderStepId
    }
    return 'builder:inputs'
  })

  const activeStepIndex = computed(() => steps.value.indexOf(activeStep.value))

  const isFirstStep = computed(() => activeStepIndex.value === 0)

  const isLastStep = computed(() => {
    if (builderTarget.value === 'app' && !options?.hasOutputs?.value)
      return (
        activeStepIndex.value >= APP_BUILDER_STEPS.indexOf('builder:arrange')
      )
    return activeStepIndex.value >= steps.value.length - 1
  })

  const isSelectStep = computed(
    () =>
      activeStep.value === 'builder:inputs' ||
      activeStep.value === 'builder:outputs'
  )

  function goBack() {
    if (isFirstStep.value) return
    setMode(steps.value[activeStepIndex.value - 1])
  }

  function goNext() {
    if (isLastStep.value) return
    setMode(steps.value[activeStepIndex.value + 1])
  }

  return {
    steps,
    activeStep,
    activeStepIndex,
    isFirstStep,
    isLastStep,
    isSelectStep,
    navigateToStep: setMode,
    goBack,
    goNext
  }
}
