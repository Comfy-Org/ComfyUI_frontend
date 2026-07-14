import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

type NodeTypeHiddenReason =
  | 'external'
  | 'registration'
  | 'dev-only'
  | 'workspace-governance'

const hiddenReasons = new WeakMap<
  typeof LGraphNode,
  Set<NodeTypeHiddenReason>
>()

export function setNodeTypeHidden(
  nodeType: typeof LGraphNode,
  reason: NodeTypeHiddenReason,
  hidden: boolean
): void {
  let reasons = hiddenReasons.get(nodeType)
  if (!reasons) {
    reasons = new Set<NodeTypeHiddenReason>()
    if (nodeType.skip_list) reasons.add('external')
  }
  if (hidden) reasons.add(reason)
  else reasons.delete(reason)
  hiddenReasons.set(nodeType, reasons)
  nodeType.skip_list = reasons.size > 0
}
