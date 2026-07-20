import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLitegraphSettings } from '@/platform/settings/composables/useLitegraphSettings'
import {
  CanvasPointer,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'

type SettingValue = boolean | number | string

// The real canvasStore exposes `canvas` via a shallowRef, so the mock must be
// reactive for the composable's watchEffects to re-run when the canvas mounts
// after setup. `vi.hoisted` runs before imports, hence the dynamic import.
const { canvasStore, settings } = await vi.hoisted(async () => {
  const { reactive } = await import('vue')
  return {
    canvasStore: reactive({
      canvas: undefined as
        | undefined
        | {
            show_info?: SettingValue
            zoom_speed?: SettingValue
            auto_pan_speed?: SettingValue
            links_render_mode?: SettingValue
            min_font_size_for_lod?: SettingValue
            linkMarkerShape?: SettingValue
            maximumFps?: SettingValue
            dragZoomEnabled?: SettingValue
            liveSelection?: SettingValue
            groupSelectChildren?: SettingValue
            draw: ReturnType<typeof vi.fn>
            setDirty: ReturnType<typeof vi.fn>
          }
    }),
    settings: {
      current: {} as Record<string, SettingValue>
    }
  }
})

vi.mock('@/lib/litegraph/src/litegraph', () => {
  class MockCanvasPointer {
    static doubleClickTime = 0
    static bufferTime = 0
    static maxClickDrift = 0
  }

  class MockLGraphNode {
    static keepAllLinksOnBypass = false
  }

  return {
    CanvasPointer: MockCanvasPointer,
    LGraphNode: MockLGraphNode,
    LiteGraph: {
      Reroute: {},
      snaps_for_comfy: false,
      snap_highlights_node: false,
      middle_click_slot_add_default_node: false,
      CANVAS_GRID_SIZE: 0,
      alwaysSnapToGrid: false,
      context_menu_scaling: 1,
      canvasNavigationMode: 'legacy',
      macTrackpadGestures: false,
      leftMouseClickBehavior: 'select',
      mouseWheelScroll: 'zoom',
      saveViewportWithGraph: false
    }
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => settings.current[key]
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStore
}))

function makeCanvas() {
  return {
    draw: vi.fn(),
    setDirty: vi.fn()
  }
}

beforeEach(() => {
  settings.current = reactive({
    'Comfy.Graph.CanvasInfo': true,
    'Comfy.Graph.ZoomSpeed': 1.25,
    'Comfy.Graph.AutoPanSpeed': 0.75,
    'Comfy.Node.AutoSnapLinkToSlot': true,
    'Comfy.Node.SnapHighlightsNode': true,
    'Comfy.Node.BypassAllLinksOnDelete': true,
    'Comfy.Node.MiddleClickRerouteNode': true,
    'Comfy.LinkRenderMode': 2,
    'LiteGraph.Canvas.MinFontSizeForLOD': 9,
    'Comfy.Graph.LinkMarkers': 'arrow',
    'LiteGraph.Canvas.MaximumFps': 42,
    'Comfy.Graph.CtrlShiftZoom': true,
    'Comfy.Graph.LiveSelection': true,
    'Comfy.Pointer.DoubleClickTime': 250,
    'Comfy.Pointer.ClickBufferTime': 80,
    'Comfy.Pointer.ClickDrift': 4,
    'Comfy.SnapToGrid.GridSize': 16,
    'pysssss.SnapToGrid': true,
    'LiteGraph.ContextMenu.Scaling': 1.5,
    'LiteGraph.Reroute.SplineOffset': 32,
    'Comfy.Canvas.NavigationMode': 'standard',
    'Comfy.Canvas.LeftMouseClickBehavior': 'panning',
    'Comfy.Canvas.MouseWheelScroll': 'panning',
    'Comfy.EnableWorkflowViewRestore': true,
    'LiteGraph.Group.SelectChildrenOnClick': true
  })
  canvasStore.canvas = reactive(makeCanvas())
})

describe('useLitegraphSettings', () => {
  it('applies canvas settings and marks affected layers dirty', () => {
    useLitegraphSettings()

    expect(canvasStore.canvas?.show_info).toBe(true)
    expect(canvasStore.canvas?.zoom_speed).toBe(1.25)
    expect(canvasStore.canvas?.auto_pan_speed).toBe(0.75)
    expect(canvasStore.canvas?.links_render_mode).toBe(2)
    expect(canvasStore.canvas?.min_font_size_for_lod).toBe(9)
    expect(canvasStore.canvas?.linkMarkerShape).toBe('arrow')
    expect(canvasStore.canvas?.maximumFps).toBe(42)
    expect(canvasStore.canvas?.dragZoomEnabled).toBe(true)
    expect(canvasStore.canvas?.liveSelection).toBe(true)
    expect(canvasStore.canvas?.groupSelectChildren).toBe(true)
    expect(canvasStore.canvas?.draw).toHaveBeenCalledWith(false, true)
    expect(canvasStore.canvas?.setDirty).toHaveBeenCalledWith(false, true)
    expect(canvasStore.canvas?.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('applies global LiteGraph and pointer settings', () => {
    useLitegraphSettings()

    expect(LiteGraph.snaps_for_comfy).toBe(true)
    expect(LiteGraph.snap_highlights_node).toBe(true)
    expect(LGraphNode.keepAllLinksOnBypass).toBe(true)
    expect(LiteGraph.middle_click_slot_add_default_node).toBe(true)
    expect(CanvasPointer.doubleClickTime).toBe(250)
    expect(CanvasPointer.bufferTime).toBe(80)
    expect(CanvasPointer.maxClickDrift).toBe(4)
    expect(LiteGraph.CANVAS_GRID_SIZE).toBe(16)
    expect(LiteGraph.alwaysSnapToGrid).toBe(true)
    expect(LiteGraph.context_menu_scaling).toBe(1.5)
    expect(LiteGraph.Reroute.maxSplineOffset).toBe(32)
    expect(LiteGraph.canvasNavigationMode).toBe('standard')
    expect(LiteGraph.macTrackpadGestures).toBe(true)
    expect(LiteGraph.leftMouseClickBehavior).toBe('panning')
    expect(LiteGraph.mouseWheelScroll).toBe('panning')
    expect(LiteGraph.saveViewportWithGraph).toBe(true)
  })

  it('responds when reactive settings change', async () => {
    useLitegraphSettings()

    settings.current['Comfy.Graph.CanvasInfo'] = false
    settings.current['Comfy.Canvas.NavigationMode'] = 'custom'
    settings.current['LiteGraph.Group.SelectChildrenOnClick'] = false
    await nextTick()

    expect(canvasStore.canvas?.show_info).toBe(false)
    expect(canvasStore.canvas?.groupSelectChildren).toBe(false)
    expect(LiteGraph.canvasNavigationMode).toBe('custom')
    expect(LiteGraph.macTrackpadGestures).toBe(false)
  })

  it('updates global settings when the canvas is not mounted yet', () => {
    canvasStore.canvas = undefined

    useLitegraphSettings()

    expect(LiteGraph.snaps_for_comfy).toBe(true)
    expect(CanvasPointer.doubleClickTime).toBe(250)
  })

  it('applies canvas settings once the canvas mounts after setup', async () => {
    canvasStore.canvas = undefined

    useLitegraphSettings()

    canvasStore.canvas = reactive(makeCanvas())
    await nextTick()

    expect(canvasStore.canvas?.show_info).toBe(true)
    expect(canvasStore.canvas?.zoom_speed).toBe(1.25)
    expect(canvasStore.canvas?.links_render_mode).toBe(2)
    expect(canvasStore.canvas?.draw).toHaveBeenCalledWith(false, true)
    expect(canvasStore.canvas?.setDirty).toHaveBeenCalledWith(false, true)
  })
})
