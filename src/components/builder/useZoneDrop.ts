import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import { inputItemKey } from '@/components/builder/itemKeyHelper'
import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import { useAppModeStore } from '@/stores/appModeStore'

interface WidgetDragData {
  type: 'zone-widget'
  nodeId: NodeId
  widgetName: string
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

interface GroupDragData {
  type: 'zone-group'
  groupId: string
  sourceZone: string
}

function isGroupDragData(
  data: Record<string | symbol, unknown>
): data is Record<string | symbol, unknown> & GroupDragData {
  return data.type === 'zone-group'
}

interface DragBindingValue {
  nodeId: NodeId
  widgetName: string
  zone: string
}

type DragEl = HTMLElement & {
  __dragCleanup?: () => void
  __dragValue?: DragBindingValue
  __zoneId?: string
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
        if (isRunControlsDragData(data))
          return data.sourceZone !== typedEl.__zoneId
        if (isPresetStripDragData(data))
          return data.sourceZone !== typedEl.__zoneId
        if (isGroupDragData(data)) return data.sourceZone !== typedEl.__zoneId
        return false
      },
      onDragEnter: () => el.classList.add('zone-drag-over'),
      onDragLeave: () => el.classList.remove('zone-drag-over'),
      onDrop: ({ source, location, self }) => {
        el.classList.remove('zone-drag-over')
        // Skip if a nested drop target (e.g. group body) is the innermost target
        const innermost = location.current.dropTargets[0]
        if (innermost && innermost.element !== self.element) return

        const data = source.data
        if (isWidgetDragData(data)) {
          const itemKey = inputItemKey(data.nodeId, data.widgetName)
          appModeStore.moveWidgetItem(itemKey, {
            kind: 'zone',
            zoneId: typedEl.__zoneId!
          })
          appModeStore.setZone(data.nodeId, data.widgetName, typedEl.__zoneId!)
        } else if (isRunControlsDragData(data)) {
          appModeStore.setRunControlsZone(typedEl.__zoneId!)
        } else if (isPresetStripDragData(data)) {
          appModeStore.setPresetStripZone(typedEl.__zoneId!)
        } else if (isGroupDragData(data)) {
          appModeStore.moveGroupToZone(
            data.groupId,
            data.sourceZone,
            typedEl.__zoneId!
          )
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
