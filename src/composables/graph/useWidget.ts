import type { MaybeRefOrGetter } from 'vue'

import { computed, toValue } from 'vue'

import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { WidgetState } from '@/stores/widgetValueStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

/**
 * Composable for reactive access to widget state by (nodeId, widgetName).
 *
 * Provides computed accessors for widget value and metadata flags.
 * The value computed is writable, allowing direct assignment.
 *
 * @param nodeId - Node ID (can be ref or getter)
 * @param widgetName - Widget name (can be ref or getter)
 */
export function useWidget(
  nodeId: MaybeRefOrGetter<NodeId>,
  widgetName: MaybeRefOrGetter<string>
) {
  const store = useWidgetValueStore()

  const widget = computed<WidgetState | undefined>(() =>
    store.getWidget(toValue(nodeId), toValue(widgetName))
  )

  const value = computed({
    get: () => widget.value?.value,
    set: (v: unknown) => store.set(toValue(nodeId), toValue(widgetName), v)
  })

  const isHidden = computed(() => widget.value?.hidden ?? false)
  const isDisabled = computed(() => widget.value?.disabled ?? false)
  const isAdvanced = computed(() => widget.value?.advanced ?? false)
  const isPromoted = computed(() => widget.value?.promoted ?? false)
  const label = computed(() => widget.value?.label)

  return {
    widget,
    value,
    isHidden,
    isDisabled,
    isAdvanced,
    isPromoted,
    label
  }
}
