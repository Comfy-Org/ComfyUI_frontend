import { defineStore } from 'pinia'
import { type Raw, computed, markRaw, ref, shallowRef } from 'vue'

import type { Point, Positionable } from '@/lib/litegraph/src/interfaces'
import type {
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { isLGraphGroup, isLGraphNode, isReroute } from '@/utils/litegraphUtil'

export const useTitleEditorStore = defineStore('titleEditor', () => {
  const titleEditorTarget = shallowRef<LGraphNode | LGraphGroup | null>(null)

  return {
    titleEditorTarget
  }
})

export const useCanvasStore = defineStore('canvas', () => {
  /**
   * The LGraphCanvas instance.
   *
   * The root LGraphCanvas object is a shallow ref.
   */
  const canvas = shallowRef<LGraphCanvas | null>(null)
  /**
   * The selected items on the canvas. All stored items are raw.
   */
  const selectedItems = ref<Raw<Positionable>[]>([])
  const updateSelectedItems = () => {
    const items = Array.from(canvas.value?.selectedItems ?? [])
    selectedItems.value = items.map((item) => markRaw(item))
  }

  // Reactive scale percentage that syncs with app.canvas.ds.scale
  const appScalePercentage = ref(100)

  // Set up scale synchronization when canvas is available
  let originalOnChanged: ((scale: number, offset: Point) => void) | undefined =
    undefined
  const initScaleSync = () => {
    if (app.canvas?.ds) {
      // Initial sync
      originalOnChanged = app.canvas.ds.onChanged
      appScalePercentage.value = Math.round(app.canvas.ds.scale * 100)

      // Set up continuous sync
      app.canvas.ds.onChanged = () => {
        if (app.canvas?.ds?.scale) {
          appScalePercentage.value = Math.round(app.canvas.ds.scale * 100)
        }
        // Call original handler if exists
        originalOnChanged?.(app.canvas.ds.scale, app.canvas.ds.offset)
      }
    }
  }

  const cleanupScaleSync = () => {
    if (app.canvas?.ds) {
      app.canvas.ds.onChanged = originalOnChanged
      originalOnChanged = undefined
    }
  }

  const nodeSelected = computed(() => selectedItems.value.some(isLGraphNode))
  const groupSelected = computed(() => selectedItems.value.some(isLGraphGroup))
  const rerouteSelected = computed(() => selectedItems.value.some(isReroute))

  const getCanvas = () => {
    if (!canvas.value) throw new Error('getCanvas: canvas is null')
    return canvas.value
  }

  /**
   * Sets the canvas zoom level from a percentage value
   * @param percentage - Zoom percentage value (1-1000, where 1000 = 1000% zoom)
   */
  const setAppZoomFromPercentage = (percentage: number) => {
    if (!app.canvas?.ds || percentage <= 0) return

    // Convert percentage to scale (1000% = 10.0 scale)
    const newScale = percentage / 100
    const ds = app.canvas.ds

    ds.changeScale(
      newScale,
      ds.element ? [ds.element.width / 2, ds.element.height / 2] : undefined
    )
    app.canvas.setDirty(true, true)

    // Update reactive value immediately for UI consistency
    appScalePercentage.value = Math.round(newScale * 100)
  }

  return {
    canvas,
    selectedItems,
    nodeSelected,
    groupSelected,
    rerouteSelected,
    appScalePercentage,
    updateSelectedItems,
    getCanvas,
    setAppZoomFromPercentage,
    initScaleSync,
    cleanupScaleSync
  }
})
