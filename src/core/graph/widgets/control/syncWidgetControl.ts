import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'
import type { UUID } from '@/utils/uuid'

import { isValueControlWidget } from './controlWidgetMarker'

/**
 * Registers (or clears) the control component for a target widget, derived from
 * its linked widgets. Called wherever the target's value is registered, so
 * control state follows the same deferral as value state.
 */
export function syncWidgetControl(
  targetId: WidgetId,
  graphId: UUID,
  nodeId: NodeId,
  linkedWidgets: readonly IBaseWidget[] | undefined
): void {
  const store = useWidgetValueStore()
  const control = linkedWidgets?.find(isValueControlWidget)
  if (!control) {
    store.deleteWidgetControl(targetId)
    return
  }

  const filter = linkedWidgets?.find(
    (widget) => widget !== control && widget.type === 'string'
  )
  store.registerWidgetControl(targetId, {
    controlWidgetId: widgetId(graphId, nodeId, control.name),
    filterWidgetId: filter ? widgetId(graphId, nodeId, filter.name) : undefined
  })
}
