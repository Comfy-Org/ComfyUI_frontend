import type { InjectionKey, Ref } from 'vue'

import type { NodeId } from '@/renderer/extensions/superComfy/engine/documentSchema'

import type { PortSide } from './canvasGeometry'

export interface SuperCanvasContext {
  draftActive: Readonly<Ref<boolean>>
  isCompatible(nodeId: NodeId, port: string): boolean
  onPortPointerDown(
    event: PointerEvent,
    nodeId: NodeId,
    side: PortSide,
    port: string
  ): void
}

export const SuperCanvasKey: InjectionKey<SuperCanvasContext> =
  Symbol('superComfyCanvas')
