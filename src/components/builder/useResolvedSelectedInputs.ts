import { useEventListener } from '@vueuse/core'
import { computed, shallowRef, triggerRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputWidgetConfig } from '@/platform/workflow/management/stores/comfyWorkflow'
import { app } from '@/scripts/app'
import { useAppModeStore } from '@/stores/appModeStore'
import type { WidgetEntityId } from '@/world/entityIds'
import { isWidgetEntityId, parseWidgetEntityId } from '@/world/entityIds'

/**
 * A `selectedInputs` entry resolved against the live graph. Resolved entries
 * carry the live `node`/`widget` references; unresolved entries (whose target
 * node or widget has been removed) are surfaced as `status: 'unknown'` so the
 * UI can render a "remove dangling selection" affordance instead of silently
 * dropping the row.
 */
export type ResolvedSelection =
  | {
      status: 'resolved'
      entityId: WidgetEntityId
      node: LGraphNode
      widget: IBaseWidget
      displayName: string
      config?: InputWidgetConfig
    }
  | {
      status: 'unknown'
      entityId: WidgetEntityId
      displayName: string
      config?: InputWidgetConfig
    }

/**
 * Resolve `appModeStore.selectedInputs` to live `(node, widget)` pairs.
 *
 * The persisted shape is `[WidgetEntityId, displayName, InputWidgetConfig?]`;
 * this projection layers the live widget/node references on top of each entry
 * so handlers (rename, remove, resize, bounding) can act on widget instances
 * directly without re-walking the graph.
 *
 * Reactivity sources:
 * - `appModeStore.selectedInputs` (deep-reactive ref)
 * - root graph node list (tracked via shallow ref + `configured` event)
 * - subgraph slot label changes (tracked via `node:slot-label:changed`)
 *
 * NOTE: A `WidgetEntityId` encodes `${graphId}:${nodeId}:${widgetName}`. Slot
 * label renames mutate `widget.label` but not `widget.name` (see
 * `SubgraphNode.ts`'s `renaming-input` handler), so the entityId remains stable
 * across renames. If a future code path mutates `widget.name`, persisted
 * entries would silently drop here; rewiring would need a new event.
 * TODO: revisit if such a path is introduced.
 */
export function useResolvedSelectedInputs() {
  const appModeStore = useAppModeStore()

  const graphNodes = shallowRef<LGraphNode[]>(app.rootGraph?.nodes ?? [])
  useEventListener(
    () => app.rootGraph?.events,
    'configured',
    () => (graphNodes.value = app.rootGraph?.nodes ?? [])
  )
  useEventListener(
    () => app.rootGraph?.events,
    'node:slot-label:changed',
    () => triggerRef(graphNodes)
  )

  return computed<ResolvedSelection[]>(() => {
    void graphNodes.value
    const rootGraph = app.rootGraph
    if (!rootGraph) return []

    return appModeStore.selectedInputs.flatMap(
      ([entityId, displayName, config]): ResolvedSelection[] => {
        if (!isWidgetEntityId(entityId)) return []
        const { nodeId, name } = parseWidgetEntityId(entityId)
        const node = rootGraph.getNodeById(nodeId)
        const widget = node?.widgets?.find((w) => w.name === name)
        if (!node || !widget) {
          return [{ status: 'unknown', entityId, displayName, config }]
        }
        return [
          { status: 'resolved', entityId, node, widget, displayName, config }
        ]
      }
    )
  })
}
