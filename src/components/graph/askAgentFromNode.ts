import { referenceNodesInAgent } from '@/components/graph/referenceNodesInAgent'
import type { NodeId } from '@/types/nodeId'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'

/** Adds the node chip and prompt text to the main composer. Does not send. */
export function fillNodeAskAgentPrompt(nodeId: NodeId, text: string): boolean {
  if (!referenceNodesInAgent([nodeId], 'node_hover')) return false
  const composer = useAgentComposerStore()
  composer.setText(text)
  composer.requestEditorFocus()
  return true
}

/** Adds the node chip and prompt, then asks the main composer to send. */
export function sendNodeAskAgentPrompt(nodeId: NodeId, text: string): boolean {
  if (!text.trim()) return false
  if (!fillNodeAskAgentPrompt(nodeId, text)) return false
  useAgentComposerStore().requestSubmit()
  return true
}
