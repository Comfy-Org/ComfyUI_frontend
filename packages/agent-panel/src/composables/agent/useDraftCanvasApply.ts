import { watch } from 'vue'

import { useAgentDraftStore } from '@/stores/agent/agentDraftStore'

/**
 * useDraftCanvasApply: the canvas half of the draft pipeline. Whenever a newer draft
 * version lands in the store (live draft_patch or reconnect resync), the full graph is
 * handed to the injected apply callback. The HOST injects the actual canvas load
 * (e.g. app.loadGraphData); the panel itself has no canvas. Returns the watch stop
 * handle so the host can tear down with its mount.
 */
export function useDraftCanvasApply(
  apply: (content: Record<string, unknown>, version: number) => void
): () => void {
  const draftStore = useAgentDraftStore()
  return watch(
    () => draftStore.version,
    (version) => {
      if (version === null || draftStore.content === null) return
      apply(draftStore.content, version)
    }
  )
}
