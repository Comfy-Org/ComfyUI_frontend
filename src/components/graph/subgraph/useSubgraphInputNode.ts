import { computedWithControl, useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

export function useSubgraphInputNode() {
  const context = useSubgraphInputValuesStore()
  const { t } = useI18n()
  const collapsed = ref(false)
  const slots = computedWithControl(
    () => context.graph,
    () => context.graph?.inputNode.allSlots ?? []
  )
  useEventListener(
    () => context.graph?.events,
    [
      'input-added',
      'removing-input',
      'renaming-input',
      'inputs-reordered',
      'configured'
    ],
    slots.trigger
  )
  const options = computed(() =>
    context.candidates.map((node) => ({
      value: `${node.graphId}:${node.id}`,
      name: t('subgraphInputValues.instance', {
        title: node.title,
        id: node.id
      })
    }))
  )
  const selectedKey = computed({
    get: () =>
      context.selected
        ? `${context.selected.graphId}:${context.selected.id}`
        : undefined,
    set: (value: string | number | undefined) => {
      const host = context.candidates.find(
        (node) => `${node.graphId}:${node.id}` === value
      )
      if (host) context.selectHost(host)
    }
  })

  function handleKeydown(event: KeyboardEvent) {
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key !== 'Escape'
    ) {
      event.stopPropagation()
    }
  }

  return { context, collapsed, slots, options, selectedKey, handleKeydown }
}
