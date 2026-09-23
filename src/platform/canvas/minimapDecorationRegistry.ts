import { readonly, shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import type { GraphScope } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

interface MinimapDecorationTarget extends GraphScope {
  readonly nodeId: NodeId
}

interface MinimapNodeDecoration {
  readonly target: MinimapDecorationTarget
  readonly enter?: 'pop'
}

interface RegisteredLayer {
  readonly rows: Map<string, ResolvedMinimapNodeDecoration>
  disposed: boolean
}

export interface MinimapDecorationLayer {
  replace(rows: readonly MinimapNodeDecoration[]): void
  dispose(): void
}

export interface ResolvedMinimapNodeDecoration extends MinimapNodeDecoration {
  readonly enteredAt?: number
}

const layers = new Map<string, RegisteredLayer>()
const revision = shallowRef(0)

function targetKey(target: MinimapDecorationTarget): string {
  return `${target.rootGraphId}:${target.owningGraphId}:${target.nodeId}`
}

function copyDecoration(
  row: MinimapNodeDecoration,
  enteredAt?: number
): ResolvedMinimapNodeDecoration {
  return {
    target: { ...row.target },
    enter: row.enter,
    enteredAt
  }
}

function invalidate(): void {
  revision.value += 1
}

/**
 * Registers transient, graph-scoped minimap decorations. Producers own which
 * nodes are decorated and when the layer is disposed; the minimap exclusively
 * owns projection, palette, paint order, and animation scheduling.
 */
export function registerMinimapDecorationLayer(
  id: string
): MinimapDecorationLayer {
  if (layers.has(id)) {
    reportError(new Error(`Minimap decoration layer exists: ${id}`), {
      errorType: 'minimap_decoration_layer_duplicate'
    })
    return { replace() {}, dispose() {} }
  }

  const layer: RegisteredLayer = { rows: new Map(), disposed: false }
  layers.set(id, layer)

  return {
    replace(rows) {
      if (layer.disposed) return
      const next = new Map<string, ResolvedMinimapNodeDecoration>()
      const now = performance.now()
      for (const [index, row] of rows.entries()) {
        const key = targetKey(row.target)
        const previous = layer.rows.get(key)
        const enteredAt =
          row.enter === 'pop'
            ? (previous?.enteredAt ?? now + Math.min(index, 8) * 50)
            : undefined
        next.set(key, copyDecoration(row, enteredAt))
      }
      layer.rows.clear()
      for (const [key, row] of next) layer.rows.set(key, row)
      invalidate()
    },
    dispose() {
      if (layer.disposed) return
      layer.disposed = true
      layers.delete(id)
      invalidate()
    }
  }
}

export const minimapDecorationRevision = readonly(revision)

export function getMinimapDecorations(
  scope: GraphScope
): readonly ResolvedMinimapNodeDecoration[] {
  return [...layers.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, layer]) => [...layer.rows.values()])
    .filter(
      ({ target }) =>
        target.rootGraphId === scope.rootGraphId &&
        target.owningGraphId === scope.owningGraphId
    )
    .map((row) => copyDecoration(row, row.enteredAt))
}
