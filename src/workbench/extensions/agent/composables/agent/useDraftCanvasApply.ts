import { watch } from 'vue'

import { useAgentDraftStore } from '../../stores/agent/agentDraftStore'

export function useDraftCanvasApply(
  apply: (content: Record<string, unknown>) => void
): () => void {
  const draftStore = useAgentDraftStore()
  return watch(
    () => draftStore.version,
    (version) => {
      if (version === null || draftStore.content === null) return
      apply(draftStore.content)
    }
  )
}
