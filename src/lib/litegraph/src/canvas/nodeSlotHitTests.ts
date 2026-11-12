import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { ItemLocator } from '@comfyorg/graph-model/linkNetwork'

export const nodeSlotHitTests = new WeakMap<
  ItemLocator,
  (x: number, y: number) => LGraphNode | null
>()
