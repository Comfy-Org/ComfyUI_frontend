import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { Ref } from 'vue'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type { NodeId } from '@/types/nodeId'

export interface MinimapLayerNode {
  readonly nodeId: NodeId
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface MinimapLayerDrawContext {
  readonly ctx: CanvasRenderingContext2D
  readonly graph: LGraph
  readonly nodes: readonly MinimapLayerNode[]
  readonly now: number
}

export interface MinimapLayer {
  readonly revision: Readonly<Ref<number>>
  draw(context: MinimapLayerDrawContext): void
  isAnimating(now: number): boolean
}

export const useMinimapLayerStore = defineStore('minimapLayers', () => {
  const layers = shallowRef<readonly MinimapLayer[]>([])

  function register(layer: MinimapLayer): () => void {
    layers.value = [...layers.value, layer]
    return () => {
      layers.value = layers.value.filter((candidate) => candidate !== layer)
    }
  }

  return { layers, register }
})
