import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface NumberWidgetOptions {
  step?: number
  step2?: number
  precision?: number
}

export function useNumberStepCalculation(
  optionsArg: MaybeRefOrGetter<NumberWidgetOptions | undefined>,
  precisionArg: MaybeRefOrGetter<number | undefined>,
  returnUndefinedForDefault = false
) {
  return computed(() => {
    const options = toValue(optionsArg)
    const precision = toValue(precisionArg)
    if (options?.step2 !== undefined) {
      return options.step2
    }
    const step = options?.step
    if (step !== undefined && step > 10) {
      return step / 10
    }

    if (precision === undefined) {
      return returnUndefinedForDefault ? undefined : 0
    }

    if (precision === 0) return 1

    const calculatedStep = 1 / Math.pow(10, precision)
    return returnUndefinedForDefault
      ? calculatedStep
      : Number(calculatedStep.toFixed(precision))
  })
}
