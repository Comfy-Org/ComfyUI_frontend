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
  const consumedSig = ref<string | null>(null)
  const stagedSig = ref<string | null>(null)
  const dismissedSig = ref<string | null>(null)

  watch(
    () => (toValue(options.isLive) ? toValue(options.selection) : []),
    (nodes) => {
      if (nodes.length === 0) {
        staged.value = []
        consumedSig.value = null
        stagedSig.value = null
        dismissedSig.value = null
        return
      }
      const sig = signature(nodes)
      if (sig !== dismissedSig.value) dismissedSig.value = null
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

  // Removing the last chip is an explicit "not this selection" - the live
  // selection must not sneak back into the turn until it changes.
  function dismissed(): boolean {
    return (
      dismissedSig.value !== null &&
      dismissedSig.value === signature(toValue(options.selection))
    )
  }

  function remove(id: string): void {
    staged.value = staged.value.filter((node) => node.id !== id)
    if (staged.value.length === 0)
      dismissedSig.value = signature(toValue(options.selection))
  }

  function add(node: SelectedNode): void {
    if (staged.value.some((tag) => tag.id === node.id)) return
    staged.value = [...staged.value, node]
  }

  return { staged, consume, dismissed, remove, add }
}
