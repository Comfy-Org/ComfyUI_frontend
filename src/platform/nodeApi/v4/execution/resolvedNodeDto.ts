import type { ISlotType } from '@comfyorg/graph-model/interfaces'

import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'

import type { Resolver } from '@/platform/nodeApi/v4/types'
import { runs } from './nodeModes'
import type { Resolutions } from './resolution'

/** The prompt builder's form of a node whose outputs a pack's resolver answers for. */
export class ResolvedNodeDTO extends ExecutableNodeDTO {
  private readonly resolve: Resolver
  private readonly resolutions: Resolutions

  constructor(
    original: ExecutableNodeDTO,
    resolve: Resolver,
    resolutions: Resolutions
  ) {
    super(
      original.node,
      original.subgraphNodePath,
      original.nodesByExecutionId,
      original.subgraphNode
    )
    this.resolve = resolve
    this.resolutions = resolutions
  }

  override resolveOutput(
    slot: number,
    type: ISlotType,
    visited: Set<string>
  ): ReturnType<ExecutableNodeDTO['resolveOutput']> {
    const resolution = runs(this)
      ? this.resolutions.outputOf(this.graph, this.node, this.resolve, slot)
      : undefined
    switch (resolution?.kind) {
      case undefined:
        return super.resolveOutput(slot, type, visited)
      case 'omit':
        return undefined
      case 'literal':
        return {
          node: this,
          origin_id: this.id,
          origin_slot: -1,
          widgetInfo: { value: structuredClone(resolution.value) }
        }
      case 'forward': {
        const id = [...this.subgraphNodePath, resolution.node.id].join(':')
        return this.nodesByExecutionId
          .get(id)
          ?.resolveInput(resolution.input, visited, type)
      }
    }
  }
}
