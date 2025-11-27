import { onMounted, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

import { useGlobalSeedStore } from '@/stores/globalSeedStore'
import type { ControlWidgetOptions } from '@/types/simplifiedWidget'

import { numberControlRegistry } from '../services/NumberControlRegistry'

export enum NumberControlMode {
  FIXED = 'fixed',
  INCREMENT = 'increment',
  DECREMENT = 'decrement',
  RANDOMIZE = 'randomize',
  LINK_TO_GLOBAL = 'linkToGlobal'
}

interface StepperControlOptions {
  min?: number
  max?: number
  step?: number
  step2?: number
  onChange?: (value: number) => void
}

function convertToEnum(str?: ControlWidgetOptions): NumberControlMode {
  switch (str) {
    case 'fixed':
      return NumberControlMode.FIXED
    case 'increment':
      return NumberControlMode.INCREMENT
    case 'decrement':
      return NumberControlMode.DECREMENT
    case 'randomize':
      return NumberControlMode.RANDOMIZE
  }
  return NumberControlMode.RANDOMIZE
}

export function useStepperControl(
  modelValue: Ref<number>,
  options: StepperControlOptions,
  defaultValue?: ControlWidgetOptions
) {
  const controlMode = ref<NumberControlMode>(convertToEnum(defaultValue))
  const controlId = Symbol('numberControl')
  const globalSeedStore = useGlobalSeedStore()

  const applyControl = () => {
    const { min = 0, max = 1000000, step2, step = 1, onChange } = options
    // Use step2 if available (widget context), otherwise use step as-is (direct API usage)
    const actualStep = step2 !== undefined ? step2 : step

    let newValue: number
    switch (controlMode.value) {
      case NumberControlMode.FIXED:
        // Do nothing - keep current value
        return
      case NumberControlMode.INCREMENT:
        newValue = Math.min(max, modelValue.value + actualStep)
        break
      case NumberControlMode.DECREMENT:
        newValue = Math.max(min, modelValue.value - actualStep)
        break
      case NumberControlMode.RANDOMIZE:
        newValue = Math.floor(Math.random() * (max - min + 1)) + min
        break
      case NumberControlMode.LINK_TO_GLOBAL:
        // Use global seed value, constrained by min/max
        newValue = Math.max(min, Math.min(max, globalSeedStore.globalSeed))
        break
      default:
        return
    }

    if (onChange) {
      onChange(newValue)
    } else {
      modelValue.value = newValue
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
