import { useChainCallback } from '@/composables/functional/useChainCallback'
import { resolveNodeRootGraphId } from '@/lib/litegraph/src/utils/widget'
import { useExtensionService } from '@/services/extensionService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

const DIMENSION_WIDGETS = new Set(['width', 'height'])

useExtensionService().registerExtension({
  name: 'Comfy.CreateBoundingBoxes',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'CreateBoundingBoxes') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 420), Math.max(oldHeight, 560)])

    const widgetValueStore = useWidgetValueStore()

    const syncDimensionVisibility = () => {
      const slot = node.findInputSlot('background')
      const hidden = slot >= 0 && node.isInputConnected(slot)
      const graphId = resolveNodeRootGraphId(node)
      for (const widget of node.widgets ?? []) {
        if (!DIMENSION_WIDGETS.has(widget.name)) continue
        widget.hidden = hidden
        const state = graphId
          ? widgetValueStore.getWidget(graphId, node.id, widget.name)
          : undefined
        if (state?.options) state.options.hidden = hidden
        else widget.options.hidden = hidden
      }
    }

    syncDimensionVisibility()
    node.onConnectionsChange = useChainCallback(
      node.onConnectionsChange,
      syncDimensionVisibility
    )
  }
})
