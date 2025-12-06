import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

import type { ControlOptions } from '@/types/simplifiedWidget'

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

function convertToEnum(str?: ControlOptions): NumberControlMode {
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

function useControlButtonIcon(controlMode: Ref<NumberControlMode>) {
  return computed(() => {
    switch (controlMode.value) {
      case NumberControlMode.INCREMENT:
        return 'pi pi-plus'
      case NumberControlMode.DECREMENT:
        return 'pi pi-minus'
      case NumberControlMode.FIXED:
        return 'icon-[lucide--pencil-off]'
      case NumberControlMode.LINK_TO_GLOBAL:
        return 'pi pi-link'
      default:
        return 'icon-[lucide--shuffle]'
    }
  })
}

export function useStepperControl(
  modelValue: Ref<number>,
  options: StepperControlOptions,
  defaultValue?: ControlOptions
) {
  const controlMode = ref<NumberControlMode>(convertToEnum(defaultValue))
  const controlId = Symbol('numberControl')

  const applyControl = () => {
    const { min = 0, max = 1000000, step2, step = 1, onChange } = options
    const safeMax = Math.min(2 ** 50, max)
    const safeMin = Math.max(-(2 ** 50), min)
    // Use step2 if available (widget context), otherwise use step as-is (direct API usage)
    const actualStep = step2 !== undefined ? step2 : step

    let newValue: number
    switch (controlMode.value) {
      case NumberControlMode.FIXED:
        // Do nothing - keep current value
        return
      case NumberControlMode.INCREMENT:
        newValue = Math.min(safeMax, modelValue.value + actualStep)
        break
      case NumberControlMode.DECREMENT:
        newValue = Math.max(safeMin, modelValue.value - actualStep)
        break
      case NumberControlMode.RANDOMIZE:
        newValue = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin
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
  const controlButtonIcon = useControlButtonIcon(controlMode)

  return {
    applyControl,
    controlButtonIcon,
    controlMode
  }
}
