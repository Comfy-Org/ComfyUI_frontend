import { computed } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { LinkedUpstreamInfo } from '@/types/simplifiedWidget'

interface UpstreamWidget {
  name: string
  type: string
  value?: unknown
}

type ValueExtractor = (
  widgets: UpstreamWidget[],
  outputName: string | undefined
) => unknown | undefined

export function useUpstreamValue(
  getLinkedUpstream: () => LinkedUpstreamInfo | undefined,
  extractValue: ValueExtractor
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

export function singleValueExtractor(
  isValid: (value: unknown) => boolean
): ValueExtractor {
  return (widgets, outputName) => {
    if (outputName) {
      const matched = widgets.find((w) => w.name === outputName)
      if (matched && isValid(matched.value)) return matched.value
    }
    const valid = widgets.filter((w) => isValid(w.value))
    return valid.length === 1 ? valid[0].value : undefined
  }
}

function isBoundsObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number'
  )
}

export function boundsExtractor(): ValueExtractor {
  const single = singleValueExtractor(isBoundsObject)
  return (widgets, outputName) => {
    const singleResult = single(widgets, outputName)
    if (singleResult) return singleResult

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
