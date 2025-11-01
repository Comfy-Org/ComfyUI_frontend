import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  IComboWidget,
  IMappedComboWidget
} from '@/lib/litegraph/src/types/widgets'
import { isHashFilename } from '@/lib/litegraph/src/utils/hashFilenameUtils'

import type { WidgetEventOptions } from './BaseWidget'
import { ComboWidget } from './ComboWidget'

export class MappedComboWidget
  extends ComboWidget
  implements IMappedComboWidget
{
  override type: 'mapped_combo' = 'mapped_combo'

  declare options: IMappedComboWidget['options']

  constructor(widget: IMappedComboWidget, node: LGraphNode) {
    super(widget as IComboWidget, node)
  }

  override get _displayValue(): string {
    if (this.computedDisabled) return ''

    const value =
      typeof this.value === 'number' ? String(this.value) : this.value

    if (!isHashFilename(value) || !this.options.mapValue) {
      return value
    }

    try {
      return this.options.mapValue(value)
    } catch (e) {
      console.error('Failed to map hash filename to human-readable name:', e)
      return value
    }
  }

  /**
   * Widget layout (40px arrow zones on each side):
   * [← 40px ][      center click area       ][ 40px →]
   * 0        40                            width-40  width
   */
  override onClick({ e, node, canvas }: WidgetEventOptions) {
    // Convert canvas coordinates to node-relative coordinates
    // e.canvasX is absolute position, node.pos[0] is node's left edge
    const x = e.canvasX - node.pos[0]

    // Widget width, fallback to node width if not explicitly set
    const width = this.width || node.size[0]
    // Left arrow zone: first 40 pixels from node's left edge
    if (x < 40) return this.decrementValue({ e, node, canvas })

    // Right arrow zone: last 40 pixels
    if (x > width - 40) return this.incrementValue({ e, node, canvas })

    // Center click - show dropdown with mapped values
    const { values } = this.options
    if (!values) return

    const valuesArray = Array.isArray(values) ? values : Object.keys(values)

    const mapFn = this.options.mapValue
    const displayValues = mapFn
      ? valuesArray.map((v) => {
          const strValue = String(v)
          if (!isHashFilename(strValue)) {
            return strValue
          }

          try {
            return mapFn(strValue)
          } catch (e) {
            console.error('Failed to map value for dropdown:', e)
            return strValue
          }
        })
      : valuesArray

    new LiteGraph.ContextMenu(displayValues, {
      scale: Math.max(1, canvas.ds.scale), // Prevent menu scaling below 100% (always readable)
      event: e,
      className: 'dark',
      callback: (displayValue: string) => {
        // Find the original value that corresponds to this display value
        const index = displayValues.indexOf(displayValue)
        const actualValue = valuesArray[index]
        this.setValue(actualValue, { e, node, canvas })
      }
    })
  }
}
