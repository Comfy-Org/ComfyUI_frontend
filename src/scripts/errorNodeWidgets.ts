import { useChainCallback } from '@/composables/functional/useChainCallback'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useBooleanWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useBooleanWidget'
import { useFloatWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useFloatWidget'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'

const StringWidget = useStringWidget()
const FloatWidget = useFloatWidget()
const BooleanWidget = useBooleanWidget()

function unknownWidgetName(node: LGraphNode): string {
  const count = node.widgets?.length ?? 0
  return count === 0 ? 'UNKNOWN' : `UNKNOWN_${count}`
}

function addWidgetFromValue(node: LGraphNode, value: unknown) {
  let widget: IBaseWidget
  const name = unknownWidgetName(node)

  if (typeof value === 'string') {
    widget = StringWidget(node, {
      type: 'STRING',
      name,
      multiline: value.length > 20
    })
  } else if (typeof value === 'number') {
    widget = FloatWidget(node, {
      type: 'FLOAT',
      name,
      default: value
    })
  } else if (typeof value === 'boolean') {
    widget = BooleanWidget(node, {
      type: 'BOOLEAN',
      name,
      default: value
    })
  } else {
    widget = StringWidget(node, {
      type: 'STRING',
      name,
      multiline: true
    })
    widget.value = JSON.stringify(value)
    widget.label = 'UNKNOWN'
    return
  }

  widget.value = value
  widget.label = 'UNKNOWN'
}

function addWidgetsFromSerialisedValues(
  this: LGraphNode,
  info: ISerialisedNode
) {
  if (!this.has_errors || !info.widgets_values) return

  for (let i = 0; i < info.widgets_values.length; i++) {
    addWidgetFromValue(this, info.widgets_values[i])
  }

  this.serialize_widgets = true
}

let installed = false

/**
 * Chains placeholder widgets for missing node types onto
 * `LGraphNode.prototype.onConfigure`. Later calls are no-ops.
 */
export function installErrorNodeWidgets() {
  if (installed) return
  installed = true
  LGraphNode.prototype.onConfigure = useChainCallback(
    LGraphNode.prototype.onConfigure,
    addWidgetsFromSerialisedValues
  )
}
