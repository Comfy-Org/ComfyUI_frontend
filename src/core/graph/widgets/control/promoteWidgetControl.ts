import cloneDeep from 'es-toolkit/compat/cloneDeep'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { parseWidgetId, widgetId } from '@/types/widgetId'
import type { UUID } from '@/utils/uuid'

import { isValueControlWidget } from './controlWidgetMarker'

function registerHostControl(
  graphId: UUID,
  hostNodeId: NodeId,
  name: string,
  source: IBaseWidget
): WidgetId {
  const id = widgetId(graphId, hostNodeId, name)
  useWidgetValueStore().registerWidget(id, {
    type: source.type,
    value: source.value,
    options: cloneDeep(source.options ?? {})
  })
  return id
}

/**
 * Mints a host-local control component when a controllable interior widget is
 * promoted. The host control/filter become independent widget entities seeded
 * once from the interior; afterward they are queried and advanced purely by
 * their own ids, never tracing back into the interior.
 */
export function promoteWidgetControl(
  hostTargetId: WidgetId,
  interiorWidget: Readonly<IBaseWidget>
): void {
  const store = useWidgetValueStore()
  const { graphId, nodeId, name } = parseWidgetId(hostTargetId)
  const control = interiorWidget.linkedWidgets?.find(isValueControlWidget)
  if (!control) {
    store.deleteWidgetControl(hostTargetId)
    return
  }

  const filter = interiorWidget.linkedWidgets?.find(
    (widget) => widget !== control && widget.type === 'string'
  )
  store.registerWidgetControl(hostTargetId, {
    controlWidgetId: registerHostControl(
      graphId,
      nodeId,
      `${name}:control`,
      control
    ),
    filterWidgetId: filter
      ? registerHostControl(graphId, nodeId, `${name}:control_filter`, filter)
      : undefined
  })
}
