import { clamp } from 'es-toolkit/compat'

import type { IContextMenuValue } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ComboWidgetValues,
  IComboWidget,
  IStringComboWidget
} from '@/lib/litegraph/src/types/widgets'
import { warnDeprecated } from '@/lib/litegraph/src/utils/feedback'
import { findComboValueIndex } from '@/lib/litegraph/src/utils/widget'

import { BaseSteppedWidget } from './BaseSteppedWidget'
import { extensionValue } from './BaseWidget'
import type { WidgetEventOptions } from './BaseWidget'

/**
 * This is used as an (invalid) assertion to resolve issues with legacy duck-typed values.
 *
 * Function style in use by:
 * https://github.com/kijai/ComfyUI-KJNodes/blob/c3dc82108a2a86c17094107ead61d63f8c76200e/web/js/setgetnodes.js#L401-L404
 */
type Values =
  | Exclude<
      ComboWidgetValues,
      (widget?: IComboWidget, node?: LGraphNode) => string[]
    >
  | ((widget?: ComboWidget, node?: LGraphNode) => string[])

function toArray(values: Values): (string | number)[] {
  return Array.isArray(values) ? values : Object.keys(values)
}

function toContextMenuValue(
  value: string | number,
  label: string
): string | IContextMenuValue<number> {
  return typeof value === 'number' ? { content: label, value } : value
}

export class ComboWidget
  extends BaseSteppedWidget<IStringComboWidget | IComboWidget>
  implements IComboWidget
{
  override type = 'combo' as const

  override get _displayValue() {
    if (this.computedDisabled) return ''

    const getOptionLabel = this.options.getOptionLabel
    if (getOptionLabel) {
      const stringValue =
        typeof this.value === 'number' ? String(this.value) : this.value
      try {
        return getOptionLabel(stringValue || null)
      } catch (e) {
        console.error('Failed to map value:', e)
        return stringValue
      }
    }

    const rawValues = extensionValue(this.options.values)
    if (rawValues) {
      const values = extensionValue(
        typeof rawValues === 'function' ? rawValues() : rawValues
      )

      if (values && !Array.isArray(values)) {
        return values[this.value]
      }
    }
    return typeof this.value === 'number' ? String(this.value) : this.value
  }

  private getValues(node: LGraphNode): Values {
    const values = extensionValue(this.options.values)
    if (values == null) {
      console.error('[ComboWidget]: values is required')
      return []
    }

    return typeof values === 'function' ? values(this, node) : values
  }

  /**
   * Checks if the value is {@link Array.at at} the given index in the combo list.
   * @param increment `true` if checking the use of the increment button, `false` for decrement
   * @returns `true` if the value is at the given index, otherwise `false`.
   */
  private canUseButton(increment: boolean): boolean {
    const { values } = this.options
    // If using legacy duck-typed method, false is the most permissive return value
    if (typeof values === 'function') return false

    const valuesArray = toArray(values)
    if (!(valuesArray.length > 1)) return false

    const currentIndex = Array.isArray(values)
      ? findComboValueIndex(valuesArray, this.value)
      : valuesArray.indexOf(String(this.value))
    return currentIndex !== (increment ? valuesArray.length - 1 : 0)
  }

  /**
   * Returns `true` if the current value is not the last value in the list.
   */
  override canIncrement(): boolean {
    return this.canUseButton(true)
  }

  override canDecrement(): boolean {
    return this.canUseButton(false)
  }

  override incrementValue(options: WidgetEventOptions): void {
    this.tryChangeValue(1, options)
  }

  override decrementValue(options: WidgetEventOptions): void {
    this.tryChangeValue(-1, options)
  }

  private tryChangeValue(delta: number, options: WidgetEventOptions): void {
    const values = this.getValues(options.node)
    const indexedValues = toArray(values)

    // avoids double click event
    options.canvas.last_mouseclick = 0

    const currentIndex = Array.isArray(values)
      ? findComboValueIndex(indexedValues, this.value)
      : indexedValues.indexOf(String(this.value))
    const foundIndex = currentIndex + delta

    const index = clamp(foundIndex, 0, indexedValues.length - 1)

    const value = Array.isArray(values) ? values[index] : index
    this.setValue(value, options)
  }

  override onClick({ e, node, canvas }: WidgetEventOptions) {
    const x = e.canvasX - node.pos[0]
    const width = this.width || node.size[0]

    // Deprecated functionality (warning as of v0.14.5)
    if (typeof this.options.values === 'function') {
      warnDeprecated(
        'Using a function for values is deprecated. Use an array of unique values instead.'
      )
    }

    // Determine if clicked on left/right arrows
    if (x < 40) return this.decrementValue({ e, node, canvas })
    if (x > width - 40) return this.incrementValue({ e, node, canvas })

    // Otherwise, show dropdown menu
    const values = this.getValues(node)
    const values_list = toArray(values)

    // Use addItem to solve duplicate filename issues
    if (this.options.getOptionLabel) {
      const menuOptions = {
        scale: Math.max(1, canvas.ds.scale),
        event: e,
        className: 'dark',
        callback: (value?: string | IContextMenuValue<number>) => {
          const selectedValue = typeof value === 'string' ? value : value?.value
          if (selectedValue !== undefined) {
            this.setValue(selectedValue, { e, node, canvas })
          }
        }
      }
      const menu = new LiteGraph.ContextMenu<number>([], menuOptions)

      const getOptionLabel = this.options.getOptionLabel
      for (const value of values_list) {
        try {
          const label = getOptionLabel(String(value))
          menu.addItem(label, toContextMenuValue(value, label), menuOptions)
        } catch (err) {
          console.error('Failed to map value:', err)
          const label = String(value)
          menu.addItem(label, toContextMenuValue(value, label), menuOptions)
        }
      }
      return
    }

    // Show dropdown menu when user clicks on widget label
    const text_values = values != values_list ? Object.values(values) : values
    new LiteGraph.ContextMenu(text_values, {
      scale: Math.max(1, canvas.ds.scale),
      event: e,
      className: 'dark',
      callback: (value?: string | number | IContextMenuValue) => {
        if (value === undefined || typeof value === 'object') return
        this.setValue(
          values != values_list ? text_values.indexOf(value) : value,
          { e, node, canvas }
        )
      }
    })
  }
}
