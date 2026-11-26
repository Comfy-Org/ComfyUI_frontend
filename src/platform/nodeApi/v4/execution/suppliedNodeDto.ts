import type { ISlotType } from '@comfyorg/graph-model/interfaces'

import { ExecutableNodeDTO } from '@/lib/litegraph/src/litegraph'

import type { Supply } from './supply'

/** The prompt builder's form of a node whose unlinked inputs a pack's supplier feeds. */
export class SuppliedNodeDTO extends ExecutableNodeDTO {
  private readonly supplies: ReadonlyMap<number, Supply>

  constructor(
    original: ExecutableNodeDTO,
    supplies: ReadonlyMap<number, Supply>
  ) {
    super(
      original.node,
      original.subgraphNodePath,
      original.nodesByExecutionId,
      original.subgraphNode
    )
    this.supplies = supplies
  }

  override resolveInput(
    slot: number,
    visited = new Set<string>(),
    type?: ISlotType
  ): ReturnType<ExecutableNodeDTO['resolveInput']> {
    const linked = super.resolveInput(slot, visited, type)
    const supply = this.supplies.get(slot)
    if (!supply) return linked
    const supplier = this.nodesByExecutionId.get(
      [...this.subgraphNodePath, supply.supplier.id].join(':')
    )
    const inputType = type ?? this.inputs[slot].type
    return supply.from.kind === 'output'
      ? supplier?.resolveOutput(supply.from.output, inputType, visited)
      : supplier?.resolveInput(supply.from.input, visited, inputType)
  }
}
