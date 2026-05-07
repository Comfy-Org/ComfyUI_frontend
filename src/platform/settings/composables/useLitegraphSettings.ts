import { watchEffect } from 'vue'

import {
  CanvasPointer,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useInputDeviceDetection } from '@/platform/settings/composables/useInputDeviceDetection'
import { useSettingStore } from '@/platform/settings/settingStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * One-time translation of the legacy `Comfy.Canvas.NavigationMode` +
 * `Comfy.Canvas.MouseWheelScroll` pair into the new `Comfy.Graph.WheelInputMode`
 * preference, preserving explicit choices made by users on previous versions.
 *
 * Idempotency is achieved by resetting NavigationMode to its default after
 * migration: subsequent boots see `legacy` and exit early.
 */
async function migrateLegacyNavigationSettings(
  settingStore: ReturnType<typeof useSettingStore>
) {
  const navMode = settingStore.get('Comfy.Canvas.NavigationMode')
  if (navMode === 'legacy') return

  let migrated: 'mouse' | 'trackpad' | undefined
  if (navMode === 'standard') {
    migrated = 'trackpad'
  } else if (navMode === 'custom') {
    const wheelScroll = settingStore.get('Comfy.Canvas.MouseWheelScroll')
    migrated = wheelScroll === 'panning' ? 'trackpad' : 'mouse'
  }

  if (migrated && settingStore.get('Comfy.Graph.WheelInputMode') === 'auto') {
    await settingStore.set('Comfy.Graph.WheelInputMode', migrated)
  }
  await settingStore.set('Comfy.Canvas.NavigationMode', 'legacy')
}

/**
 * Watch for changes in the setting store and update the LiteGraph settings accordingly.
 */
export const useLitegraphSettings = () => {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()

  void migrateLegacyNavigationSettings(settingStore)

  watchEffect(() => {
    const canvasInfoEnabled = settingStore.get('Comfy.Graph.CanvasInfo')
    if (canvasStore.canvas) {
      canvasStore.canvas.show_info = canvasInfoEnabled
      canvasStore.canvas.draw(false, true)
    }
  })

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

  watchEffect(() => {
    const linkRenderMode = settingStore.get('Comfy.LinkRenderMode')
    if (canvasStore.canvas) {
      canvasStore.canvas.links_render_mode = linkRenderMode
      canvasStore.canvas.setDirty(/* fg */ false, /* bg */ true)
    }
  })

  watchEffect(() => {
    const minFontSizeForLOD = settingStore.get(
      'LiteGraph.Canvas.MinFontSizeForLOD'
    )
    if (canvasStore.canvas) {
      canvasStore.canvas.min_font_size_for_lod = minFontSizeForLOD
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
    const leftMouseBehavior = settingStore.get(
      'Comfy.Canvas.LeftMouseClickBehavior'
    ) as 'panning' | 'select'
    LiteGraph.leftMouseClickBehavior = leftMouseBehavior
  })

  watchEffect(() => {
    LiteGraph.wheelInputMode = settingStore.get(
      'Comfy.Graph.WheelInputMode'
    ) as 'auto' | 'mouse' | 'trackpad'
  })

  /**
   * Mirror the canvas pointer's auto-detected device onto a reactive ref so
   * settings UI can show the current detection inside the "Auto" option.
   * The cleanup detaches the handler from the previous pointer so a stale
   * canvas instance can no longer mutate the shared ref after replacement.
   */
  watchEffect((onCleanup) => {
    const { canvas } = canvasStore
    if (!canvas) return
    const { pointer } = canvas
    const { detectedInputDevice } = useInputDeviceDetection()
    detectedInputDevice.value = pointer.detectedDevice
    pointer.onDetectedDeviceChange = (device) => {
      detectedInputDevice.value = device
    }
    onCleanup(() => {
      pointer.onDetectedDeviceChange = undefined
    })
  })

  watchEffect(() => {
    LiteGraph.saveViewportWithGraph = settingStore.get(
      'Comfy.EnableWorkflowViewRestore'
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
