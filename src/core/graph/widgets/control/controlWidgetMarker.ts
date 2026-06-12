import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

export const IS_CONTROL_WIDGET = Symbol()

export function isValueControlWidget(widget: IBaseWidget): boolean {
  return (widget as Record<symbol, unknown>)[IS_CONTROL_WIDGET] === true
}
