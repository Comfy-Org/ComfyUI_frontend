import { ref, toValue, watch } from 'vue'

import type { MaybeRefOrGetter } from 'vue'

export interface SelectedNode {
  id: string
  title: string
}

export interface UseCanvasSelectionOptions {
  selection: MaybeRefOrGetter<SelectedNode[]>
  isLive: MaybeRefOrGetter<boolean>
}

function signature(nodes: SelectedNode[]): string {
  return nodes
    .map((node) => node.id)
    .sort()
    .join(',')
}

export function useCanvasSelection(options: UseCanvasSelectionOptions) {
  const staged = ref<SelectedNode[]>([])
  // consumedSig: the same selection must not re-tag every message. stagedSig: a watcher
  // re-fire with no real change must not resurrect tags the user dismissed via remove().
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
