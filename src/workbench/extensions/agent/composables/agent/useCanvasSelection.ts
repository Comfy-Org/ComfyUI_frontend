import { ref, toValue, watch } from 'vue'

import type { MaybeRefOrGetter, Ref } from 'vue'
import type { NodeLocatorId } from '@/types/nodeIdentification'

export interface SelectedNode {
  id: string
  locatorId?: NodeLocatorId
  title: string
}

export function selectedNodeKey(node: SelectedNode): string {
  return node.locatorId ?? node.id
}

export interface UseCanvasSelectionOptions {
  selection: MaybeRefOrGetter<SelectedNode[]>
  isLive: MaybeRefOrGetter<boolean>
  isTracking?: MaybeRefOrGetter<boolean>
  isPaused?: MaybeRefOrGetter<boolean>
  scope?: MaybeRefOrGetter<string | null>
  dismissedSignature?: Ref<string | null>
}

function signature(scope: string | null, nodes: SelectedNode[]): string {
  return JSON.stringify([scope, nodes.map(selectedNodeKey).sort()])
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
        toValue(options.isTracking ?? true),
        toValue(options.isPaused ?? false),
        toValue(options.scope ?? null),
        toValue(options.selection)
      ] as const,
    ([isLive, isTracking, isPaused, scope, nodes]) => {
      if (isPaused) return
      if (!isLive) {
        staged.value = []
        consumedSig.value = null
        stagedSig.value = null
        lastLiveSig = null
        return
      }
      if (!isTracking) return
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
    staged.value = staged.value.filter((node) => selectedNodeKey(node) !== id)
    if (staged.value.length === 0) dismissedSig.value = currentSignature()
  }

  function add(node: SelectedNode): void {
    if (
      staged.value.some((tag) => selectedNodeKey(tag) === selectedNodeKey(node))
    )
      return
    staged.value = [...staged.value, node]
  }

  function replace(nodes: SelectedNode[]): void {
    staged.value = [...nodes]
    consumedSig.value = null
    stagedSig.value = nodes.length
      ? signature(toValue(options.scope ?? null), nodes)
      : null
    if (nodes.length) dismissedSig.value = null
  }

  return { staged, consume, dismissed, remove, add, replace }
}
