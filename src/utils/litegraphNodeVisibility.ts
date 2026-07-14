import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type NodeTypeHiddenReason = 'registration' | 'dev-only' | 'workspace-governance'

type NodeTypeVisibilityState = {
  externalHidden: boolean
  lastAppliedHidden: boolean
  reasons: Set<NodeTypeHiddenReason>
}

const visibilityStates = new WeakMap<
  typeof LGraphNode,
  NodeTypeVisibilityState
>()

export function setNodeTypeHidden(
  nodeType: typeof LGraphNode,
  reason: NodeTypeHiddenReason,
  hidden: boolean
): void {
  let state = visibilityStates.get(nodeType)
  if (!state) {
    const externalHidden = Boolean(nodeType.skip_list)
    state = {
      externalHidden,
      lastAppliedHidden: externalHidden,
      reasons: new Set<NodeTypeHiddenReason>()
    }
    visibilityStates.set(nodeType, state)
  } else if (Boolean(nodeType.skip_list) !== state.lastAppliedHidden) {
    state.externalHidden = Boolean(nodeType.skip_list)
  }

  if (hidden) state.reasons.add(reason)
  else state.reasons.delete(reason)

  const nextHidden = state.externalHidden || state.reasons.size > 0
  nodeType.skip_list = nextHidden
  state.lastAppliedHidden = nextHidden
}
