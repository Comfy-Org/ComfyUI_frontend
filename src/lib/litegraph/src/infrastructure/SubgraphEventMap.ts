import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { LGraphEventMap } from './LGraphEventMap'

export interface SubgraphEventMap extends LGraphEventMap {
  'adding-input': {
    name: string
    type: string
  }
  'adding-output': {
    name: string
    type: string
  }

  'input-added': {
    input: SubgraphInput
  }
  'output-added': {
    output: SubgraphOutput
  }

  'removing-input': {
    input: SubgraphInput
    index: number
  }
  'removing-output': {
    output: SubgraphOutput
    index: number
  }

  /**
   * Fires after `subgraph.inputs` order is rewritten by an input-reorder
   * helper (e.g. `reorderSubgraphInputsByName`,
   * `reorderSubgraphInputsByWidgetOrder`, `reorderSubgraphInputAtIndex`).
   *
   * Dispatched after `invalidatePromotedViews()`, the link `origin_slot`
   * reindex, and the value-restore pass — listeners see fully consistent
   * state. No-op reorders (where the order didn't actually change) do not
   * dispatch.
   */
  'inputs-reordered': {
    subgraph: Subgraph
    oldOrder: readonly string[]
    newOrder: readonly string[]
  }

  'renaming-input': {
    input: SubgraphInput
    index: number
    oldName: string
    newName: string
  }
  'renaming-output': {
    output: SubgraphOutput
    index: number
    oldName: string
    newName: string
  }

  'widget-promoted': {
    widget: IBaseWidget
    subgraphNode: SubgraphNode
  }
  'widget-demoted': {
    widget: IBaseWidget
    subgraphNode: SubgraphNode
  }
}
