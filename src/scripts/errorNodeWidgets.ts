import { IWidget, LGraphNode } from '@comfyorg/litegraph'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useBooleanWidget } from '@/composables/widgets/useBooleanWidget'
import { useFloatWidget } from '@/composables/widgets/useFloatWidget'
import { useStringWidget } from '@/composables/widgets/useStringWidget'

const StringWidget = useStringWidget()
const FloatWidget = useFloatWidget()
const BooleanWidget = useBooleanWidget()

function addWidgetFromValue(node: LGraphNode, value: unknown) {
  let widget: IWidget

  if (typeof value === 'string') {
    widget = StringWidget(node, {
      type: 'STRING',
      name: 'UNKNOWN',
      multiline: value.length > 20
    })
  } else if (typeof value === 'number') {
    widget = FloatWidget(node, {
      type: 'FLOAT',
      name: 'UNKNOWN'
    })
  } else if (typeof value === 'boolean') {
    widget = BooleanWidget(node, {
      type: 'BOOLEAN',
      name: 'UNKNOWN'
    })
  } else {
    console.warn(`Unknown value type: ${typeof value}`)
    return
  }

  widget.value = value
}

/**
 * Try add widgets to node with missing definition.
 */
LGraphNode.prototype.onConfigure = useChainCallback(
  LGraphNode.prototype.onConfigure,
  function (this: LGraphNode, info) {
    if (!this.has_errors || !info.widgets_values) return

    for (let i = 0; i < info.widgets_values.length; i++) {
      const widgetValue = info.widgets_values[i]
      addWidgetFromValue(this, widgetValue)
    }

    this.serialize_widgets = true
  }
)
