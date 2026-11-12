<script setup lang="ts">
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import { WidgetRenderOwnerKey } from '@/renderer/extensions/vueNodes/widgets/composables/useWidgetRenderOwner'
import Button from '@comfyorg/design-system/button/Button'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const { label, resolve, host, shared } = defineProps<{
  label: string
  resolve: () => InputValueSource
  host: NodeState
  shared: boolean
}>()
const emit = defineEmits<{ locate: [node: NodeState] }>()
const { t } = useI18n()
const canvasStore = useCanvasStore()
const workflowStore = useWorkflowStore()
const source = computed(resolve)
const upstream = computed(() => {
  const current = source.value
  return current.kind !== 'unavailable' && current.node !== host
    ? current.node
    : undefined
})
const owner = computed(() =>
  source.value.kind === 'editable' ? source.value : undefined
)
provide(
  WidgetRenderOwnerKey,
  computed(() => owner.value?.node)
)
const { processedWidgets } = useProcessedWidgets(
  () => owner.value?.node,
  () => (owner.value ? [owner.value.widgetId] : [])
)
const widget = computed(() => processedWidgets.value[0])
const isDisabled = computed(
  () =>
    canvasStore.isReadOnly ||
    !!widget.value?.simplified.options?.disabled ||
    !!widget.value?.simplified.options?.read_only
)

const widgets = computed(() => {
  const target = owner.value
  const rendered = widget.value
  if (!target || !rendered) return []
  const { node, widgetId } = target
  function commit(value: WidgetValue) {
    const current = resolve()
    if (
      isDisabled.value ||
      current.kind !== 'editable' ||
      current.widgetId !== widgetId ||
      current.node !== node
    )
      return
    rendered.updateHandler(value)
    canvasStore.canvas?.setDirty(true, true)
    workflowStore.activeWorkflow?.changeTracker.captureCanvasState()
  }
  return [
    {
      ...rendered,
      slotMetadata: undefined,
      handleContextMenu(event: PointerEvent) {
        event.preventDefault()
        event.stopPropagation()
      },
      simplified: { ...rendered.simplified, callback: commit },
      updateHandler: commit
    }
  ]
})
</script>

<template>
  <div class="space-y-1">
    <div
      v-if="upstream"
      class="flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span
        class="min-w-0 flex-1 truncate"
        :title="t('subgraphInputValues.sourceHint')"
      >
        {{
          t('subgraphInputValues.fromSource', {
            title: upstream.title,
            id: upstream.id
          })
        }}
      </span>
      <span
        v-if="shared"
        class="shrink-0 rounded-sm bg-secondary px-1 py-0.5 text-2xs"
      >
        {{ t('subgraphInputValues.sharedSource') }}
      </span>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('subgraphInputValues.locateSource')"
        @click="emit('locate', upstream)"
      >
        <i class="icon-[lucide--locate-fixed]" />
      </Button>
    </div>
    <fieldset
      class="min-w-0 border-0 p-0"
      :disabled="isDisabled"
      :inert="isDisabled"
    >
      <legend class="mb-1 w-full truncate text-xs text-muted-foreground">
        {{ label }}
      </legend>
      <WidgetGrid
        v-if="owner && widget"
        :key="owner.widgetId"
        :processed-widgets="widgets"
        :node-id="owner.node.id"
        :node-type="owner.node.type"
        :node-title="owner.node.title"
        :sync-layout="false"
        class="pr-0"
      />
      <p v-else class="m-0 text-xs text-muted-foreground">
        {{
          source.kind === 'linked'
            ? t('subgraphInputValues.linked')
            : t('subgraphInputValues.unavailable')
        }}
      </p>
    </fieldset>
  </div>
</template>
