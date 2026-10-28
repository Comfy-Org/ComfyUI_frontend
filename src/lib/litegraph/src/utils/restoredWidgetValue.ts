import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'

function coerceNumericString(value: string): number | string {
  if (!/^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*$/i.test(value))
    return value
  const parsed = Number(value)
  const representable = Number.isInteger(parsed)
    ? Number.isSafeInteger(parsed)
    : Number.isFinite(parsed)
  return representable ? parsed : value
}

function coerceBooleanString(value: string): boolean | string {
  switch (value.trim().toLowerCase()) {
    case 'true':
      return true
    case 'false':
      return false
    default:
      return value
  }
}

/**
 * Converts a saved numeric or `true`/`false` string to the value type of a
 * numeric or toggle widget, and returns any other value unchanged.
 */
export function coerceRestoredWidgetValue(
  widget: Pick<IBaseWidget, 'type' | 'options'>,
  value: TWidgetValue
): TWidgetValue {
  if (typeof value !== 'string') return value
  switch (widget.type) {
    case 'toggle':
      return coerceBooleanString(value)
    case 'number':
    case 'slider':
    case 'knob':
    case 'gradientslider':
      return coerceNumericString(value)
    case 'color':
      return 'format' in widget.options && widget.options.format === 'int'
        ? coerceNumericString(value)
        : value
    default:
      return value
  }
}
