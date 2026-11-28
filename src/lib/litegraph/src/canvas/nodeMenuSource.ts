import type { LGraphCanvas } from '@comfyorg/graph-model/entityRegistry'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'

type MenuSource = () => (IContextMenuValue | null)[]

const sources = new WeakMap<LGraphCanvas, MenuSource>()

export function getNodeMenuSource(canvas: LGraphCanvas) {
  return sources.get(canvas)
}

export function withNodeMenuSource<T>(
  canvas: LGraphCanvas,
  source: MenuSource,
  collect: () => T
): T {
  const previous = sources.get(canvas)
  sources.set(canvas, source)
  try {
    return collect()
  } finally {
    if (previous) sources.set(canvas, previous)
    else sources.delete(canvas)
  }
}
