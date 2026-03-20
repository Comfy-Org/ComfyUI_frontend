import {
  draggable,
  dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import type { Directive } from 'vue'

import { getTemplate } from '@/components/builder/layoutTemplates'
import { useAppModeStore } from '@/stores/appModeStore'

interface ZoneReorderDragData {
  type: 'zone-reorder'
  zoneId: string
}

function isZoneReorderDragData(
  data: Record<string | symbol, unknown>
): data is Record<string | symbol, unknown> & ZoneReorderDragData {
  return data.type === 'zone-reorder'
}

type ReorderEl = HTMLElement & {
  __dragCleanup?: () => void
  __zoneId?: string
}

/** Directive to make a zone header draggable for reordering. */
export const vZoneReorderDraggable: Directive<HTMLElement, string> = {
  mounted(el, { value: zoneId }) {
    const typedEl = el as ReorderEl
    typedEl.__zoneId = zoneId
    typedEl.__dragCleanup = draggable({
      element: el,
      getInitialData: () => ({
        type: 'zone-reorder',
        zoneId: typedEl.__zoneId!
      })
    })
  },
  updated(el, { value: zoneId }) {
    ;(el as ReorderEl).__zoneId = zoneId
  },
  unmounted(el) {
    ;(el as ReorderEl).__dragCleanup?.()
  }
}

/** Directive to make a zone a drop target for reordering. */
export const vZoneReorderDropTarget: Directive<HTMLElement, string> = {
  mounted(el, { value: zoneId }) {
    const typedEl = el as ReorderEl
    typedEl.__zoneId = zoneId
    const appModeStore = useAppModeStore()

    typedEl.__dragCleanup = dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const data = source.data
        return isZoneReorderDragData(data) && data.zoneId !== typedEl.__zoneId
      },
      onDragEnter: () => el.classList.add('zone-reorder-over'),
      onDragLeave: () => el.classList.remove('zone-reorder-over'),
      onDrop: ({ source }) => {
        el.classList.remove('zone-reorder-over')
        const data = source.data
        if (!isZoneReorderDragData(data)) return

        const current = appModeStore.gridOverrides?.zoneOrder
        const tmpl = getTemplate(appModeStore.layoutTemplateId)
        if (!tmpl) return

        const order = current ?? tmpl.zones.map((z) => z.id)
        const fromIdx = order.indexOf(data.zoneId)
        const toIdx = order.indexOf(typedEl.__zoneId!)
        if (fromIdx === -1 || toIdx === -1) return

        const newOrder = [...order]
        newOrder.splice(fromIdx, 1)
        newOrder.splice(toIdx, 0, data.zoneId)

        appModeStore.setGridOverrides({
          ...appModeStore.gridOverrides,
          zoneOrder: newOrder
        })
      }
    })
  },
  updated(el, { value: zoneId }) {
    ;(el as ReorderEl).__zoneId = zoneId
  },
  unmounted(el) {
    ;(el as ReorderEl).__dragCleanup?.()
  }
}
