import { ref, toValue, watch } from 'vue'

import type { MaybeRefOrGetter, Ref } from 'vue'

export interface SelectedNode {
  id: string
  title: string
}

export interface UseCanvasSelectionOptions {
  selection: MaybeRefOrGetter<SelectedNode[]>
  isLive: MaybeRefOrGetter<boolean>
  scope?: MaybeRefOrGetter<string | null>
  dismissedSignature?: Ref<string | null>
}

function signature(scope: string | null, nodes: SelectedNode[]): string {
  return JSON.stringify([scope, nodes.map((node) => node.id).sort()])
}

export function useCanvasSelection(options: UseCanvasSelectionOptions) {
  const staged = ref<SelectedNode[]>([])
  const consumedSig = ref<string | null>(null)
  const stagedSig = ref<string | null>(null)
  const dismissedSig = options.dismissedSignature ?? ref<string | null>(null)
  let lastLiveSig: string | null = null

  watch(
    () =>
      [
        toValue(options.isLive),
        toValue(options.scope ?? null),
        toValue(options.selection)
      ] as const,
    ([isLive, scope, nodes]) => {
      if (!isLive) {
        staged.value = []
        consumedSig.value = null
        stagedSig.value = null
        lastLiveSig = null
        return
      }
      if (nodes.length === 0) {
        staged.value = []
        consumedSig.value = null
        stagedSig.value = null
        if (lastLiveSig !== null) dismissedSig.value = null
        lastLiveSig = null
        return
      }
      const sig = signature(scope, nodes)
      lastLiveSig = sig
      if (sig !== dismissedSig.value) dismissedSig.value = null
      if (sig === dismissedSig.value) return
      if (sig === consumedSig.value || sig === stagedSig.value) return
      consumedSig.value = null
      stagedSig.value = sig
      staged.value = [...nodes]
    },
    { immediate: true, deep: true, flush: 'sync' }
  )

  function currentSignature(): string {
    return signature(toValue(options.scope ?? null), toValue(options.selection))
  }

  function consume(): SelectedNode[] {
    const tags = staged.value
    consumedSig.value = currentSignature()
    staged.value = []
    return tags
  }

  function dismissed(): boolean {
    return (
      dismissedSig.value !== null && dismissedSig.value === currentSignature()
    )
  }

  function remove(id: string): void {
    staged.value = staged.value.filter((node) => node.id !== id)
    if (staged.value.length === 0) dismissedSig.value = currentSignature()
  }

  function add(node: SelectedNode): void {
    if (staged.value.some((tag) => tag.id === node.id)) return
    staged.value = [...staged.value, node]
  }

  return { staged, consume, dismissed, remove, add }
}
