import { onMounted } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
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

        /** Returns the execution ID of this node, or null if the graph is not yet ready. */
        function getExecId(): string | null {
          if (!app.rootGraph) return null
          return getExecutionIdByNode(app.rootGraph, node) ?? null
        }

        // Clear simple errors when a widget value changes (legacy canvas mode).
        // In Vue node mode this path is handled in NodeWidgets.vue updateHandler.
        node.onWidgetChanged = useChainCallback(
          node.onWidgetChanged,
          function (_name, newValue, _oldValue, widget) {
            const execId = getExecId()
            if (!execId) return
            executionErrorStore.clearSimpleWidgetErrorIfValid(
              execId,
              widget.name,
              newValue,
              widget.options as { min?: number; max?: number }
            )
          }
        )

        // Clear simple errors when an input slot is connected.
        // Disconnection is intentionally ignored — the error should be re-raised on next run.
        node.onConnectionsChange = useChainCallback(
          node.onConnectionsChange,
          function (type, _index, isConnected, _link, slot) {
            if (type !== NodeSlotType.INPUT || !isConnected) return
            const execId = getExecId()
            if (!execId) return
            executionErrorStore.clearSimpleNodeErrors(execId, slot?.name)
          }
        )
      }
    })
  })
}
