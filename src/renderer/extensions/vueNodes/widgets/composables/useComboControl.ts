import { onMounted, onUnmounted, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { numberControlRegistry } from '../services/NumberControlRegistry'
import { NumberControlMode } from './useStepperControl'

type ComboValue = string | number | undefined

interface ComboControlOptions {
  values: ComputedRef<ComboValue[]>
  onChange?: (value: ComboValue) => void
}

export function useComboControl(
  modelValue: Ref<ComboValue>,
  options: ComboControlOptions
) {
  const controlMode = ref<NumberControlMode>(NumberControlMode.FIXED)
  const controlId = Symbol('comboControl')

  const applyControl = () => {
    const choices = options.values.value.filter(
      (value): value is string | number => value !== undefined
    )
    if (!choices.length) return

    const currentIndex = Math.max(
      0,
      choices.findIndex((value) => value === modelValue.value)
    )

    let nextValue: ComboValue = modelValue.value

    switch (controlMode.value) {
      case NumberControlMode.FIXED:
        return
      case NumberControlMode.INCREMENT:
        nextValue = choices[Math.min(currentIndex + 1, choices.length - 1)]
        break
      case NumberControlMode.DECREMENT:
        nextValue = choices[Math.max(currentIndex - 1, 0)]
        break
      case NumberControlMode.RANDOMIZE:
        nextValue = choices[Math.floor(Math.random() * choices.length)]
        break
      default:
        return
    }

    if (options.onChange) {
      options.onChange(nextValue)
    } else {
      modelValue.value = nextValue
    }
  }

  onMounted(() => {
    numberControlRegistry.register(controlId, applyControl)
  })

  onUnmounted(() => {
    numberControlRegistry.unregister(controlId)
  })

  return {
    controlMode,
    applyControl
  }
}
