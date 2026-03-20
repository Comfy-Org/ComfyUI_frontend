import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { OUTPUT_ZONE_KEY } from '@/components/builder/useZoneWidgets'
import { useAppModeStore } from '@/stores/appModeStore'

interface WidgetDragData {
  type: 'zone-widget'
  nodeId: NodeId
  widgetName: string
  sourceZone: string
}

interface OutputDragData {
  type: 'zone-output'
  nodeId: NodeId
  sourceZone: string
}

interface RunControlsDragData {
  type: 'zone-run-controls'
  sourceZone: string
}

interface PresetStripDragData {
  type: 'zone-preset-strip'
  sourceZone: string
}

function isWidgetDragData(
  data: Record<string | symbol, unknown>
): data is Record<string | symbol, unknown> & WidgetDragData {
  return data.type === 'zone-widget'
}

function isOutputDragData(
  data: Record<string | symbol, unknown>
): data is Record<string | symbol, unknown> & OutputDragData {
  return data.type === 'zone-output'
}

function isRunControlsDragData(
  data: Record<string | symbol, unknown>
): data is Record<string | symbol, unknown> & RunControlsDragData {
  return data.type === 'zone-run-controls'
}

function isPresetStripDragData(
  data: Record<string | symbol, unknown>
): data is Record<string | symbol, unknown> & PresetStripDragData {
  return data.type === 'zone-preset-strip'
}

interface DragBindingValue {
  nodeId: NodeId
  widgetName: string
  zone: string
}

interface OutputDragBindingValue {
  nodeId: NodeId
  zone: string
}

type DragEl = HTMLElement & {
  __dragCleanup?: () => void
  __dragValue?: DragBindingValue
  __zoneId?: string
}

type OutputDragEl = HTMLElement & {
  __dragCleanup?: () => void
  __dragValue?: OutputDragBindingValue
}

export const vWidgetDraggable: Directive<HTMLElement, DragBindingValue> = {
  mounted(el, { value }) {
    const typedEl = el as DragEl
    typedEl.__dragValue = value
    typedEl.__dragCleanup = draggable({
      element: el,
      getInitialData: () => ({
        type: 'zone-widget',
        nodeId: typedEl.__dragValue!.nodeId,
        widgetName: typedEl.__dragValue!.widgetName,
        sourceZone: typedEl.__dragValue!.zone
      })
    })
  },
  updated(el, { value }) {
    ;(el as DragEl).__dragValue = value
  },
  unmounted(el) {
    ;(el as DragEl).__dragCleanup?.()
  }
}

export const vOutputDraggable: Directive<HTMLElement, OutputDragBindingValue> =
  {
    mounted(el, { value }) {
      const typedEl = el as OutputDragEl
      typedEl.__dragValue = value
      typedEl.__dragCleanup = draggable({
        element: el,
        getInitialData: () => ({
          type: 'zone-output',
          nodeId: typedEl.__dragValue!.nodeId,
          sourceZone: typedEl.__dragValue!.zone
        })
      })
    },
    updated(el, { value }) {
      ;(el as OutputDragEl).__dragValue = value
    },
    unmounted(el) {
      ;(el as OutputDragEl).__dragCleanup?.()
    }
  }

type RunControlsDragEl = HTMLElement & {
  __dragCleanup?: () => void
  __sourceZone?: string
}

export const vRunControlsDraggable: Directive<HTMLElement, string> = {
  mounted(el, { value: sourceZone }) {
    const typedEl = el as RunControlsDragEl
    typedEl.__sourceZone = sourceZone
    typedEl.__dragCleanup = draggable({
      element: el,
      getInitialData: () => ({
        type: 'zone-run-controls',
        sourceZone: typedEl.__sourceZone!
      })
    })
  },
  updated(el, { value: sourceZone }) {
    ;(el as RunControlsDragEl).__sourceZone = sourceZone
  },
  unmounted(el) {
    ;(el as RunControlsDragEl).__dragCleanup?.()
  }
}

type PresetStripDragEl = HTMLElement & {
  __dragCleanup?: () => void
  __sourceZone?: string
}

export const vPresetStripDraggable: Directive<HTMLElement, string> = {
  mounted(el, { value: sourceZone }) {
    const typedEl = el as PresetStripDragEl
    typedEl.__sourceZone = sourceZone
    typedEl.__dragCleanup = draggable({
      element: el,
      getInitialData: () => ({
        type: 'zone-preset-strip',
        sourceZone: typedEl.__sourceZone!
      })
    })
  },
  updated(el, { value: sourceZone }) {
    ;(el as PresetStripDragEl).__sourceZone = sourceZone
  },
  unmounted(el) {
    ;(el as PresetStripDragEl).__dragCleanup?.()
  }
}

export const vZoneDropTarget: Directive<HTMLElement, string> = {
  mounted(el, { value: zoneId }) {
    const typedEl = el as DragEl
    typedEl.__zoneId = zoneId
    const appModeStore = useAppModeStore()
    typedEl.__dragCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const data = source.data
        if (isWidgetDragData(data)) return data.sourceZone !== typedEl.__zoneId
        if (isOutputDragData(data)) return data.sourceZone !== typedEl.__zoneId
        if (isRunControlsDragData(data))
          return data.sourceZone !== typedEl.__zoneId
        if (isPresetStripDragData(data))
          return data.sourceZone !== typedEl.__zoneId
        return false
      },
      onDragEnter: () => el.classList.add('zone-drag-over'),
      onDragLeave: () => el.classList.remove('zone-drag-over'),
      onDrop: ({ source }) => {
        el.classList.remove('zone-drag-over')
        const data = source.data
        if (isWidgetDragData(data)) {
          appModeStore.setZone(data.nodeId, data.widgetName, typedEl.__zoneId!)
        } else if (isOutputDragData(data)) {
          appModeStore.setZone(data.nodeId, OUTPUT_ZONE_KEY, typedEl.__zoneId!)
        } else if (isRunControlsDragData(data)) {
          appModeStore.setRunControlsZone(typedEl.__zoneId!)
        } else if (isPresetStripDragData(data)) {
          appModeStore.setPresetStripZone(typedEl.__zoneId!)
        }
      }
    })
  },
  updated(el, { value: zoneId }) {
    ;(el as DragEl).__zoneId = zoneId
  },
  unmounted(el) {
    ;(el as DragEl).__dragCleanup?.()
  }
}
