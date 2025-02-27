import type { InputSpec } from '@/schemas/nodeDefSchema'

export function getNumberDefaults(
  inputOptions: InputSpec[1],
  options: {
    defaultStep: number
    precision?: number
    enableRounding: boolean
  }
) {
  const { defaultStep } = options
  const {
    default: defaultVal = 0,
    min = 0,
    max = 2048,
    step = defaultStep
  } = inputOptions
  // precision is the number of decimal places to show.
  // by default, display the the smallest number of decimal places such that changes of size step are visible.
  const { precision = Math.max(-Math.floor(Math.log10(step)), 0) } = options

  let round = inputOptions.round
  if (options.enableRounding && (round == undefined || round === true)) {
    // by default, round the value to those decimal places shown.
    round = Math.round(1000000 * Math.pow(0.1, precision)) / 1000000
  }

  return {
    val: defaultVal,
    config: {
      min,
      max,
      /** @deprecated Use step2 instead. The 10x value is a legacy implementation. */
      step: step * 10.0,
      step2: step,
      round,
      precision
    }
  }
}
