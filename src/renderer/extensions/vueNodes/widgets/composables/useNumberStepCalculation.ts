import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

interface NumberWidgetOptions {
  step2?: number
  precision?: number
}

/**
 * Shared composable for calculating step values in number input widgets
 * Handles both explicit step2 values and precision-derived steps
 */
export function useNumberStepCalculation(
  options: NumberWidgetOptions | undefined,
  precisionArg: MaybeRefOrGetter<number | undefined>,
  returnUndefinedForDefault = false
) {
  return computed(() => {
    const precision = toValue(precisionArg)
    // Use step2 (correct input spec value) instead of step (legacy 10x value)
    if (options?.step2 !== undefined) {
      return Number(options.step2)
    }

    if (precision === undefined) {
      return returnUndefinedForDefault ? undefined : 0
    }

    if (precision === 0) return 1

    // For precision > 0, step = 1 / (10^precision)
    const step = 1 / Math.pow(10, precision)
    return returnUndefinedForDefault ? step : Number(step.toFixed(precision))
  })
}
