import { type Ref, computed } from 'vue'

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
  precision: Ref<number | undefined>,
  returnUndefinedForDefault = false
) {
  return computed(() => {
    // Use step2 (correct input spec value) instead of step (legacy 10x value)
    if (options?.step2 !== undefined) {
      return Number(options.step2)
    }

    if (precision.value === undefined) {
      return returnUndefinedForDefault ? undefined : 0
    }

    if (precision.value === 0) return 1

    // For precision > 0, step = 1 / (10^precision)
    const step = 1 / Math.pow(10, precision.value)
    return returnUndefinedForDefault
      ? step
      : Number(step.toFixed(precision.value))
  })
}
