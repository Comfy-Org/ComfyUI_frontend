import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

import { getControlProjectionBatch } from '@/core/graph/widgets/control/controlProjection'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

const wireControlCache = new WeakMap<IBaseWidget, IBaseWidget>()

export function wireWidgets(node: LGraphNode): IBaseWidget[] {
  const widgets = node.widgets ?? []
  const controls = getControlProjectionBatch(widgets)
  return widgets.flatMap((widget) => {
    if (widget.serialize === false || widget.type === 'button') return [widget]
    const projections = controls.get(widget) ?? []
    return [
      widget,
      ...projections.map((projection): IBaseWidget => {
        const cached = wireControlCache.get(projection)
        if (cached) return cached
        const control: IBaseWidget = {
          ...projection,
          get name() {
            return projection.name
          },
          serialize: true,
          get value() {
            return projection.value
          },
          set value(value) {
            projection.value = value
          }
        }
        wireControlCache.set(projection, control)
        return control
      })
    ]
  })
}
