import type { Ref } from 'vue'

import { computed } from 'vue'

import { useAppMode } from '@/composables/useAppMode'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

const BUILDER_STEPS = [
  'builder:inputs',
  'builder:outputs',
  'builder:arrange'
] as const

export type BuilderStepId = (typeof BUILDER_STEPS)[number]

export function useBuilderSteps(options?: { hasOutputs?: Ref<boolean> }) {
  const { mode, isBuilderMode, setMode } = useAppMode()
  const canvasStore = useCanvasStore()

  // API builder sessions skip the final "arrange" preview step, which only
  // shapes the App-mode layout and is not useful for an API.
  const steps = computed<readonly BuilderStepId[]>(() =>
    canvasStore.builderEnteredFromApi
      ? BUILDER_STEPS.filter((step) => step !== 'builder:arrange')
      : BUILDER_STEPS
  )

  const arrangeIndex = computed(() => steps.value.indexOf('builder:arrange'))

  const activeStep = computed<BuilderStepId>(() => {
    if (isBuilderMode.value) {
      return mode.value as BuilderStepId
    }
    return 'builder:inputs'
  })

  const activeStepIndex = computed(() => steps.value.indexOf(activeStep.value))

  const isFirstStep = computed(() => activeStepIndex.value === 0)

  const isLastStep = computed(() => {
    if (!options?.hasOutputs?.value && arrangeIndex.value >= 0)
      return activeStepIndex.value >= arrangeIndex.value
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
