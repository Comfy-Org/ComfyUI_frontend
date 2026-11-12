import { computedWithControl, useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeBadgeGroup } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { useSubgraphInputValuesStore } from './subgraphInputValuesStore'

const badges: NodeBadgeGroup[] = [
  { kind: 'core', badges: [{ text: '', cssIcon: 'icon-[comfy--workflow]' }] }
]

export function useSubgraphInputNode() {
  const context = useSubgraphInputValuesStore()
  const canvasStore = useCanvasStore()
  const commands = useCommandStore()
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
  const title = computed(() =>
    context.selected
      ? t('subgraphInputValues.instance', {
          title: context.selected.title,
          id: context.selected.id
        })
      : context.graph?.name
  )

  function leaveSubgraph() {
    if (!canvasStore.isPickingNodes) {
      void commands.execute('Comfy.Graph.ExitSubgraph')
    }
  }

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

  return {
    context,
    collapsed,
    slots,
    title,
    badges,
    leaveSubgraph,
    handleKeydown
  }
}
