import { type Ref, onMounted, onUnmounted, ref } from 'vue'

import { useGlobalSeedStore } from '@/stores/globalSeedStore'

import { numberControlRegistry } from '../services/NumberControlRegistry'

export enum NumberControlMode {
  FIXED = 'fixed',
  INCREMENT = 'increment',
  DECREMENT = 'decrement',
  RANDOMIZE = 'randomize',
  LINK_TO_GLOBAL = 'linkToGlobal'
}

interface NumberControlOptions {
  min?: number
  max?: number
  step?: number
}

export { executeNumberControls } from '../services/NumberControlRegistry'

export function useNumberControl(
  modelValue: Ref<number>,
  options: NumberControlOptions
) {
  const controlMode = ref<NumberControlMode>(NumberControlMode.FIXED)
  const controlId = Symbol('numberControl')
  const globalSeedStore = useGlobalSeedStore()

  const applyControl = () => {
    const { min = 0, max = 1000000, step = 1 } = options

    switch (controlMode.value) {
      case NumberControlMode.FIXED:
        // Do nothing - keep current value
        break
      case NumberControlMode.INCREMENT:
        modelValue.value = Math.min(max, modelValue.value + step)
        break
      case NumberControlMode.DECREMENT:
        modelValue.value = Math.max(min, modelValue.value - step)
        break
      case NumberControlMode.RANDOMIZE:
        modelValue.value = Math.floor(Math.random() * (max - min + 1)) + min
        break
      case NumberControlMode.LINK_TO_GLOBAL:
        // Use global seed value, constrained by min/max
        modelValue.value = Math.max(
          min,
          Math.min(max, globalSeedStore.globalSeed)
        )
        break
    }
  }

  // Register with singleton registry
  onMounted(() => {
    numberControlRegistry.register(controlId, applyControl)
  })

  // Cleanup on unmount
  onUnmounted(() => {
    numberControlRegistry.unregister(controlId)
  })

  return {
    controlMode,
    applyControl
  }
}
