import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

type MissingNodesNotice = (nodeTypes: readonly MissingNodeType[]) => void

const showErrorOverlay: MissingNodesNotice = () =>
  useExecutionErrorStore().showErrorOverlay()

let notice: MissingNodesNotice = showErrorOverlay

/** Tells the user that a workflow just opened needs nodes this editor lacks: the error overlay, unless a surface set its own notice. */
export function showMissingNodesNotice(
  nodeTypes: readonly MissingNodeType[]
): void {
  notice(nodeTypes)
}

/** Replaces the notice `showMissingNodesNotice` gives; the returned function puts the error overlay back. */
export function setMissingNodesNotice(next: MissingNodesNotice): () => void {
  notice = next
  return () => {
    if (notice === next) notice = showErrorOverlay
  }
}
