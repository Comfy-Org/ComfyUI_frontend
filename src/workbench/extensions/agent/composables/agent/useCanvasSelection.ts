import { ref, toValue, watch } from 'vue'

import type { MaybeRefOrGetter } from 'vue'

export interface SelectedNode {
  id: string
  title: string
}

export interface UseCanvasSelectionOptions {
  // The current canvas selection (host-injected reactive getter/ref).
  selection: MaybeRefOrGetter<SelectedNode[]>
  // Live-only gate: @-tags are meaningless while disconnected.
  isLive: MaybeRefOrGetter<boolean>
}

function signature(nodes: SelectedNode[]): string {
  return nodes
    .map((node) => node.id)
    .sort()
    .join(',')
}

/**
 * useCanvasSelection — the @-tag staging lifecycle.
 *
 * A selection is staged ONCE; consuming it on submit records its signature so the SAME
 * selection does not re-tag every subsequent message. It re-appears only when the
 * selection actually changes (a naive "always tag current selection" would re-tag forever
 * and never clear — monolith parity, comfyAgent.ts:2233-2311).
 */
export function useCanvasSelection(options: UseCanvasSelectionOptions) {
  const staged = ref<SelectedNode[]>([])
  // The selection last consumed (so the SAME selection does not re-tag every message) and
  // the selection currently staged (so a watcher re-fire with NO real change — a deep node
  // rename, an isLive flicker — does not resurrect tags the user dismissed via remove()).
  const consumedSig = ref<string | null>(null)
  const stagedSig = ref<string | null>(null)

  watch(
    () => (toValue(options.isLive) ? toValue(options.selection) : []),
    (nodes) => {
      if (nodes.length === 0) {
        staged.value = []
        consumedSig.value = null
        stagedSig.value = null
        return
      }
      const sig = signature(nodes)
      if (sig === consumedSig.value || sig === stagedSig.value) return
      consumedSig.value = null
      stagedSig.value = sig
      staged.value = [...nodes]
    },
    { immediate: true, deep: true, flush: 'sync' }
  )

  // Take the staged tags for the outgoing message and mark this selection consumed.
  function consume(): SelectedNode[] {
    const tags = staged.value
    consumedSig.value = signature(toValue(options.selection))
    staged.value = []
    return tags
  }

  function remove(id: string): void {
    staged.value = staged.value.filter((node) => node.id !== id)
  }

  return { staged, consume, remove }
}
