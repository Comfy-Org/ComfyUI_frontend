import { computed, shallowRef, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { savedImageUrls } from '@/renderer/extensions/vueNodes/widgets/utils/savedImageUrls'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { resolveInputSourceNode } from '@/utils/graphTraversalUtil'

export function useInputImageSource(
  node: ComputedRef<LGraphNode | null | undefined>,
  inputName: string,
  savedOutputKey: string,
  { preferSaved = false }: { preferSaved?: boolean } = {}
): {
  connected: ComputedRef<boolean>
  url: ComputedRef<string | undefined>
} {
  const nodeOutputStore = useNodeOutputStore()

  const connected = computed(() => {
    const target = node.value
    if (!target) return false

    const slot = target.findInputSlot(inputName)
    return slot >= 0 && target.isInputConnected(slot)
  })

  const source = computed(() => {
    const target = node.value
    if (!target || !connected.value) return undefined

    return resolveInputSourceNode(target, target.findInputSlot(inputName))
  })

  const saved = computed(() => {
    const target = node.value
    return target
      ? nodeOutputStore.getNodeOutputs(target)?.[savedOutputKey]
      : undefined
  })

  const savedSource = shallowRef(source.value)
  watch(
    saved,
    () => {
      savedSource.value = source.value
    },
    { flush: 'sync' }
  )

  const url = computed(() => {
    const current = source.value
    if (!current) return undefined

    const upstream = nodeOutputStore.getNodeImageUrls(current)?.[0]
    const savedUrl =
      savedSource.value === current ? savedImageUrls(saved.value)[0] : undefined
    return preferSaved ? (savedUrl ?? upstream) : (upstream ?? savedUrl)
  })

  return { connected, url }
}
