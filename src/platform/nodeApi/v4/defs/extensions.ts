import { once } from 'es-toolkit'

import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  NodeDef,
  NodeDefBuilder,
  Unsubscribe
} from '@/platform/nodeApi/v4/types'
import type { SelectorCandidate, TypeSelection } from './defSelector'

/** A node type that extensions apply to: one the host registered, or one a pack defined. */
export interface NodeType {
  readonly type: string
  readonly category: string
  /** A new copy of the type's definition. */
  def(): NodeDef
}

interface Extension {
  readonly selects: TypeSelection
  readonly apply: (builder: NodeDefBuilder) => void
}

interface Extensions {
  extend(
    selects: TypeSelection,
    apply: (builder: NodeDefBuilder) => void
  ): Unsubscribe
  /** Records a type, replacing an earlier registration of it, and applies every extension that selects it. */
  typeRegistered(nodeType: NodeType): void
  /** Forgets a type, if it is still registered as `nodeType`. */
  typeUnregistered(nodeType: NodeType): void
  nodeType(type: string): NodeType | undefined
  /** Every type, in the order it first registered. */
  nodeTypes(): readonly NodeType[]
}

export function createExtensions(): Extensions {
  const extensions = new Set<Extension>()
  const nodeTypes = new Map<string, NodeType>()

  function applyIfSelected(
    extension: Extension,
    candidate: SelectorCandidate
  ): void {
    if (!extensions.has(extension) || !extension.selects(candidate)) return
    const builder: NodeDefBuilder = Object.freeze({ def: candidate.def() })
    callListener('extend', () => extension.apply(builder))
  }

  return {
    extend(selects, apply) {
      const extension: Extension = { selects, apply }
      extensions.add(extension)
      for (const nodeType of Array.from(nodeTypes.values())) {
        applyIfSelected(extension, candidateFor(nodeType))
      }
      return once(() => {
        extensions.delete(extension)
      })
    },

    typeRegistered(nodeType) {
      nodeTypes.set(nodeType.type, nodeType)
      const candidate = candidateFor(nodeType)
      for (const extension of Array.from(extensions)) {
        applyIfSelected(extension, candidate)
      }
    },

    typeUnregistered(nodeType) {
      if (nodeTypes.get(nodeType.type) === nodeType) {
        nodeTypes.delete(nodeType.type)
      }
    },

    nodeType: (type) => nodeTypes.get(type),
    nodeTypes: () => Array.from(nodeTypes.values())
  }
}

function candidateFor(nodeType: NodeType): SelectorCandidate {
  return {
    type: nodeType.type,
    category: nodeType.category,
    def: once(() => nodeType.def())
  }
}
