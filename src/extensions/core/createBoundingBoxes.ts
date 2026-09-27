import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useExtensionService } from '@/services/extensionService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

const DIMENSION_WIDGETS = new Set(['width', 'height'])
const INTERNAL_WIDGETS = new Set(['last_incoming'])

useExtensionService().registerExtension({
  name: 'Comfy.CreateBoundingBoxes',

  nodeCreated(node) {
    if (node.constructor.comfyClass !== 'CreateBoundingBoxes') return

    const [oldWidth, oldHeight] = node.size
    node.setSize([Math.max(oldWidth, 420), Math.max(oldHeight, 560)])

    const widgetValueStore = useWidgetValueStore()

    const setWidgetHidden = (
      widget: NonNullable<typeof node.widgets>[number],
      hidden: boolean
    ) => {
      widget.hidden = hidden
      const state = widget.widgetId
        ? widgetValueStore.getWidget(widget.widgetId)
        : undefined
      if (state?.options) state.options.hidden = hidden
      else widget.options.hidden = hidden
    }

    const syncDimensionVisibility = () => {
      const slot = node.findInputSlot('background')
      const hidden = slot >= 0 && node.isInputConnected(slot)
      for (const widget of node.widgets ?? []) {
        if (DIMENSION_WIDGETS.has(widget.name)) setWidgetHidden(widget, hidden)
      }
    }

    for (const widget of node.widgets ?? []) {
      if (INTERNAL_WIDGETS.has(widget.name)) setWidgetHidden(widget, true)
    }

    syncDimensionVisibility()
    node.onConnectionsChange = useChainCallback(
      node.onConnectionsChange,
      syncDimensionVisibility
    )
  }
})
