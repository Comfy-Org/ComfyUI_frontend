import type { ISerialisedNode } from '@comfyorg/graph-model/serialisation'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

export interface CapturedSerialization {
  final: ISerialisedNode
  atCoreSite: unknown
  widgetsAtCoreSite: readonly IBaseWidget[] | undefined
}

export function serializeWithCapture(node: LGraphNode): CapturedSerialization {
  let atCoreSite: unknown
  let widgetsAtCoreSite: readonly IBaseWidget[] | undefined
  const previous = node.onSerialize
  node.onSerialize = function (data: ISerialisedNode) {
    atCoreSite = data.widgets_values
    widgetsAtCoreSite = this.widgets
    previous?.call(this, data)
  }
  try {
    return { final: node.serialize(), atCoreSite, widgetsAtCoreSite }
  } finally {
    node.onSerialize = previous
  }
}

export function coreIsLastWriter(node: LGraphNode): boolean {
  return (
    node.serialize === LGraphNode.prototype.serialize &&
    node.serializeFromStoreState ===
      LGraphNode.prototype.serializeFromStoreState
  )
}
