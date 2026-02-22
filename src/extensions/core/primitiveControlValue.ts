import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export const primitiveControlAfterGeneratePropertyKey =
  '__primitiveControlAfterGenerate'

const primitiveControlAfterGenerateValues = [
  'fixed',
  'increment',
  'decrement',
  'randomize'
] as const

type PrimitiveControlAfterGenerateValue =
  (typeof primitiveControlAfterGenerateValues)[number]

export function isPrimitiveControlAfterGenerateValue(
  value: unknown
): value is PrimitiveControlAfterGenerateValue {
  return (
    typeof value === 'string' &&
    primitiveControlAfterGenerateValues.includes(
      value as PrimitiveControlAfterGenerateValue
    )
  )
}

export function getControlAfterGenerateWidget(
  widgets?: IBaseWidget[]
): IBaseWidget | undefined {
  return widgets?.find(
    (widget) =>
      widget.options?.serialize === false && widget.options?.canvasOnly
  )
}
