import { onMounted } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { getExecutionIdByNode } from '@/utils/graphTraversalUtil'

/**
 * Registers a LiteGraph extension that automatically clears simple validation
 * errors (value out of range, value not in list, required input missing) when
 * the user changes a widget value or establishes an input connection.
 */
export const useNodeErrorAutoResolve = () => {
  const extensionStore = useExtensionStore()

  onMounted(() => {
    if (extensionStore.isExtensionInstalled('Comfy.NodeErrorAutoResolve'))
      return

    extensionStore.registerExtension({
      name: 'Comfy.NodeErrorAutoResolve',

      nodeCreated(node: LGraphNode) {
        const executionErrorStore = useExecutionErrorStore()
        const missingModelStore = useMissingModelStore()

        /** Returns the execution ID of this node, or null if the graph is not yet ready. */
        function getExecId(): string | null {
          if (!app.rootGraph) return null
          return getExecutionIdByNode(app.rootGraph, node) ?? null
        }

        // Clear simple errors when a widget value changes (legacy canvas mode).
        // Vue nodes do not fire onWidgetChanged; that path is handled
        // separately in NodeWidgets.vue updateHandler.
        node.onWidgetChanged = useChainCallback(
          node.onWidgetChanged,
          // _name is the string widget name from LiteGraph; we use widget.name
          // (4th arg) instead because it is the authoritative source.
          function (_name, newValue, _oldValue, widget) {
            const execId = getExecId()
            if (!execId) return
            executionErrorStore.clearSimpleWidgetErrorIfValid(
              execId,
              widget.name,
              newValue,
              { min: widget.options?.min, max: widget.options?.max }
            )
            missingModelStore.removeMissingModelByWidget(execId, widget.name)
          }
        )

        // Clear simple errors when an input slot is connected.
        // This fires for both legacy canvas and Vue nodes.
        // Disconnection is intentionally ignored — the error should be re-raised on next run.
        node.onConnectionsChange = useChainCallback(
          node.onConnectionsChange,
          function (type, _index, isConnected, _link, slot) {
            if (type !== NodeSlotType.INPUT || !isConnected) return
            if (!slot?.name) return
            const execId = getExecId()
            if (!execId) return
            executionErrorStore.clearSimpleNodeErrors(execId, slot.name)
          }
        )
      }
    })
  })
}
