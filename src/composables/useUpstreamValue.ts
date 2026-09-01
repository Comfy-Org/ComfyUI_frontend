import { computed } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetState } from '@/stores/widgetValueStore'
import type { Bounds } from '@/renderer/core/layout/types'
import type { LinkedUpstreamInfo } from '@/types/simplifiedWidget'

type ValueExtractor<T = unknown> = (
  widgets: WidgetState[],
  outputName: string | undefined
) => T | undefined

export function useUpstreamValue<T>(
  getLinkedUpstream: () => LinkedUpstreamInfo | undefined,
  extractValue: ValueExtractor<T>
) {
  const canvasStore = useCanvasStore()
  const widgetValueStore = useWidgetValueStore()

  return computed(() => {
    const upstream = getLinkedUpstream()
    if (!upstream) return undefined
    const graphId = canvasStore.canvas?.graph?.rootGraph.id
    if (!graphId) return undefined
    const widgets = widgetValueStore.getNodeWidgets(graphId, upstream.nodeId)
    return extractValue(widgets, upstream.outputName)
  })
}

export function singleValueExtractor<T>(
  isValid: (value: unknown) => value is T
): ValueExtractor<T> {
  return (widgets, outputName) => {
    if (outputName) {
      const matched = widgets.find((w) => w.name === outputName)
      if (matched && isValid(matched.value)) return matched.value
    }
    const validValues = widgets.map((w) => w.value).filter(isValid)
    return validValues.length === 1 ? validValues[0] : undefined
  }
}

function isBoundsObject(value: unknown): value is Bounds {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number'
  )
}

export function boundsExtractor(): ValueExtractor<Bounds> {
  const single = singleValueExtractor(isBoundsObject)
  return (widgets, outputName) => {
    const singleResult = single(widgets, outputName)
    if (singleResult) return singleResult

    // Fallback: assemble from individual widgets matching BoundingBoxInputSpec field names
    const getNum = (name: string): number | undefined => {
      const w = widgets.find((w) => w.name === name)
      return typeof w?.value === 'number' ? w.value : undefined
    }
    const x = getNum('x')
    const y = getNum('y')
    const width = getNum('width')
    const height = getNum('height')
    if (
      x !== undefined &&
      y !== undefined &&
      width !== undefined &&
      height !== undefined
    ) {
      return { x, y, width, height }
    }
    return undefined
  }
}
