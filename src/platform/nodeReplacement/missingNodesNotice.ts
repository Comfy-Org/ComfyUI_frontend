import type { MissingNodeType } from '@/platform/nodeReplacement/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

type MissingNodesNotice = (nodeTypes: readonly MissingNodeType[]) => void

let notice: MissingNodesNotice = () =>
  useExecutionErrorStore().showErrorOverlay()

/** Tells the user that a workflow just opened needs nodes this editor lacks: the error overlay, unless a surface set its own notice. */
export function showMissingNodesNotice(
  nodeTypes: readonly MissingNodeType[]
): void {
  notice(nodeTypes)
}

/** Replaces the notice `showMissingNodesNotice` gives. */
export function setMissingNodesNotice(next: MissingNodesNotice): void {
  notice = next
}
