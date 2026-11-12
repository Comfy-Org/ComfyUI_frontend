import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'

export function useSubgraphInputWidget(
  resolve: () => InputValueSource,
  host: MaybeRefOrGetter<NodeState>
) {
  const source = computed(resolve)
  const upstream = computed(() => {
    const current = source.value
    return current.kind !== 'unavailable' && current.node !== toValue(host)
      ? current.node
      : undefined
  })
  const owner = computed(() =>
    source.value.kind === 'editable' ? source.value : undefined
  )
  const { processedWidgets } = useProcessedWidgets(
    () => owner.value?.node,
    () => (owner.value ? [owner.value.widgetId] : [])
  )
  const widget = computed(() => processedWidgets.value[0])
  const expands = computed(() =>
    processedWidgets.value.some(
      (item) => shouldExpand(item.simplified.type) || item.hasLayoutSize
    )
  )

  return { source, upstream, owner, processedWidgets, widget, expands }
}
