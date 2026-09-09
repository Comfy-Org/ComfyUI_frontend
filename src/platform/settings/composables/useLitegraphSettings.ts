import { watch, watchEffect } from 'vue'

import {
  CanvasPointer,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Watch for changes in the setting store and update the LiteGraph settings accordingly.
 */
export const useLitegraphSettings = () => {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()

  watch(
    [
      () => settingStore.get('Comfy.Graph.CanvasInfo'),
      () => canvasStore.canvas
    ],
    ([canvasInfoEnabled, canvas]) => {
      if (canvas) {
        canvas.show_info = canvasInfoEnabled
        canvas.draw(false, true)
      }
    },
    { immediate: true }
  )

  watchEffect(() => {
    const zoomSpeed = settingStore.get('Comfy.Graph.ZoomSpeed')
    if (canvasStore.canvas) {
      canvasStore.canvas.zoom_speed = zoomSpeed
    }
  })

  watchEffect(() => {
    const autoPanSpeed = settingStore.get('Comfy.Graph.AutoPanSpeed')
    if (canvasStore.canvas) {
      canvasStore.canvas.auto_pan_speed = autoPanSpeed
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

  watch(
    [() => settingStore.get('Comfy.LinkRenderMode'), () => canvasStore.canvas],
    ([linkRenderMode, canvas]) => {
      if (canvas) {
        canvas.links_render_mode = linkRenderMode
        canvas.setDirty(false, true)
      }
    },
    { immediate: true }
  )

  watch(
    [
      () => settingStore.get('LiteGraph.Canvas.MinFontSizeForLOD'),
      () => canvasStore.canvas
    ],
    ([minFontSizeForLOD, canvas]) => {
      if (canvas) {
        canvas.min_font_size_for_lod = minFontSizeForLOD
        canvas.setDirty(true, true)
      }
    },
    { immediate: true }
  )

  watch(
    [
      () => settingStore.get('Comfy.Graph.LinkMarkers'),
      () => canvasStore.canvas
    ],
    ([linkMarkerShape, canvas]) => {
      if (canvas) {
        canvas.linkMarkerShape = linkMarkerShape
        canvas.setDirty(false, true)
      }
    },
    { immediate: true }
  )

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
    const liveSelection = settingStore.get('Comfy.Graph.LiveSelection')
    const { canvas } = canvasStore
    if (canvas) canvas.liveSelection = liveSelection
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
    const navigationMode = settingStore.get('Comfy.Canvas.NavigationMode') as
      | 'standard'
      | 'legacy'
      | 'custom'

    LiteGraph.canvasNavigationMode = navigationMode
    LiteGraph.macTrackpadGestures = navigationMode === 'standard'
  })

  watchEffect(() => {
    const leftMouseBehavior = settingStore.get(
      'Comfy.Canvas.LeftMouseClickBehavior'
    ) as 'panning' | 'select'
    LiteGraph.leftMouseClickBehavior = leftMouseBehavior
  })

  watchEffect(() => {
    const mouseWheelScroll = settingStore.get(
      'Comfy.Canvas.MouseWheelScroll'
    ) as 'panning' | 'zoom'
    LiteGraph.mouseWheelScroll = mouseWheelScroll
  })

  watchEffect(() => {
    LiteGraph.saveViewportWithGraph = settingStore.get(
      'Comfy.EnableWorkflowViewRestore'
    )
  })
  watchEffect(() => {
    LiteGraph.namedValuesRestore = settingStore.get(
      'Comfy.Workflow.NamedValuesRestore'
    )
  })

  watchEffect(() => {
    const selectChildren = settingStore.get(
      'LiteGraph.Group.SelectChildrenOnClick'
    )
    if (canvasStore.canvas)
      canvasStore.canvas.groupSelectChildren = selectChildren
  })
}
