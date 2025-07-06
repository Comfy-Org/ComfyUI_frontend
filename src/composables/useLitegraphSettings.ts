import { CanvasPointer, LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import { watchEffect } from 'vue'

import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

/**
 * Watch for changes in the setting store and update the LiteGraph settings accordingly.
 */
export const useLitegraphSettings = () => {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()

  watchEffect(() => {
    const canvasInfoEnabled = settingStore.get('Comfy.Graph.CanvasInfo')
    if (canvasStore.canvas) {
      canvasStore.canvas.show_info = canvasInfoEnabled
    }
  })

  watchEffect(() => {
    const zoomSpeed = settingStore.get('Comfy.Graph.ZoomSpeed')
    if (canvasStore.canvas) {
      canvasStore.canvas.zoom_speed = zoomSpeed
    }
  })

  watchEffect(() => {
    LiteGraph.snaps_for_comfy = settingStore.get(
      'Comfy.Node.AutoSnapLinkToSlot'
    )
  })

  watchEffect(() => {
    LiteGraph.snap_highlights_node = settingStore.get(
      'Comfy.Node.SnapHighlightsNode'
    )
  })

  watchEffect(() => {
    LGraphNode.keepAllLinksOnBypass = settingStore.get(
      'Comfy.Node.BypassAllLinksOnDelete'
    )
  })

  watchEffect(() => {
    LiteGraph.middle_click_slot_add_default_node = settingStore.get(
      'Comfy.Node.MiddleClickRerouteNode'
    )
  })

  watchEffect(() => {
    const linkRenderMode = settingStore.get('Comfy.LinkRenderMode')
    if (canvasStore.canvas) {
      canvasStore.canvas.links_render_mode = linkRenderMode
      canvasStore.canvas.setDirty(/* fg */ false, /* bg */ true)
    }
  })

  watchEffect(() => {
    const lowQualityRenderingZoomThreshold = settingStore.get(
      'LiteGraph.Canvas.LowQualityRenderingZoomThreshold'
    )
    if (canvasStore.canvas) {
      canvasStore.canvas.low_quality_zoom_threshold =
        lowQualityRenderingZoomThreshold
      canvasStore.canvas.setDirty(/* fg */ true, /* bg */ true)
    }
  })

  watchEffect(() => {
    const linkMarkerShape = settingStore.get('Comfy.Graph.LinkMarkers')
    const { canvas } = canvasStore
    if (canvas) {
      canvas.linkMarkerShape = linkMarkerShape
      canvas.setDirty(false, true)
    }
  })

  watchEffect(() => {
    const maximumFps = settingStore.get('LiteGraph.Canvas.MaximumFps')
    const { canvas } = canvasStore
    if (canvas) canvas.maximumFps = maximumFps
  })

  watchEffect(() => {
    const dragZoomEnabled = settingStore.get('Comfy.Graph.CtrlShiftZoom')
    const { canvas } = canvasStore
    if (canvas) canvas.dragZoomEnabled = dragZoomEnabled
  })

  watchEffect(() => {
    CanvasPointer.doubleClickTime = settingStore.get(
      'Comfy.Pointer.DoubleClickTime'
    )
  })

  watchEffect(() => {
    CanvasPointer.bufferTime = settingStore.get('Comfy.Pointer.ClickBufferTime')
  })

  watchEffect(() => {
    CanvasPointer.maxClickDrift = settingStore.get('Comfy.Pointer.ClickDrift')
  })

  watchEffect(() => {
    LiteGraph.CANVAS_GRID_SIZE = settingStore.get('Comfy.SnapToGrid.GridSize')
  })

  watchEffect(() => {
    LiteGraph.alwaysSnapToGrid = settingStore.get('pysssss.SnapToGrid')
  })

  watchEffect(() => {
    LiteGraph.context_menu_scaling = settingStore.get(
      'LiteGraph.ContextMenu.Scaling'
    )
  })

  watchEffect(() => {
    LiteGraph.Reroute.maxSplineOffset = settingStore.get(
      'LiteGraph.Reroute.SplineOffset'
    )
  })

  watchEffect(() => {
    LiteGraph.macTrackpadGestures = settingStore.get(
      'LiteGraph.Pointer.TrackpadGestures'
    )
  })

  watchEffect(() => {
    LiteGraph.saveViewportWithGraph = settingStore.get(
      'Comfy.EnableWorkflowViewRestore'
    )
  })
}
