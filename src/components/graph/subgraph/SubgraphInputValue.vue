<script setup lang="ts">
import { omit } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import SlotConnectionDot from '@/renderer/extensions/vueNodes/components/SlotConnectionDot.vue'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { cn } from '@comfyorg/tailwind-utils'

const {
  port,
  label,
  isAddPort = false,
  dimmed = false,
  collapsed = false,
  host,
  source
} = defineProps<{
  port: SubgraphInput
  label: string
  isAddPort?: boolean
  dimmed?: boolean
  collapsed?: boolean
  host?: NodeState
  source?: InputValueSource
}>()
const emit = defineEmits<{ locate: [node: NodeState] }>()
const { t } = useI18n()
const canvasStore = useCanvasStore()
const { forwardEventToCanvas } = useCanvasInteractions()

const shown = computed(() => (collapsed ? undefined : source))
const upstream = computed(() =>
  shown.value && shown.value.kind !== 'unavailable' && shown.value.node !== host
    ? shown.value.node
    : undefined
)
const owner = computed(() =>
  shown.value?.kind === 'editable' ? shown.value : undefined
)
const { processedWidgets } = useProcessedWidgets(
  () => owner.value?.node,
  () => (owner.value ? [owner.value.widgetId] : [])
)
const widgets = computed<WidgetGridItem[]>(() =>
  processedWidgets.value.map((item) =>
    omit(item, ['slotMetadata', 'handleContextMenu'])
  )
)
const expands = computed(() =>
  widgets.value.some(
    (item) => shouldExpand(item.simplified.type) || item.hasLayoutSize
  )
)
const status = computed(() => {
  if (!shown.value || owner.value) return undefined
  return shown.value.kind === 'linked'
    ? t('subgraphInputValues.linked')
    : t('subgraphInputValues.unavailable')
})
const sourceTitle = computed(() =>
  owner.value?.shared
    ? `${t('subgraphInputValues.sharedSource')}. ${t('subgraphInputValues.sourceHint')}`
    : t('subgraphInputValues.locateSource')
)
</script>

<template>
  <div
    data-subgraph-port
    :class="
      cn('relative flex min-w-0 items-start', expands && 'min-h-0 flex-1')
    "
  >
    <button
      v-if="upstream"
      type="button"
      class="absolute top-0 right-full mr-1 flex h-(--node-widget-height) cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-2xs whitespace-nowrap text-muted-foreground hover:text-foreground"
      :title="sourceTitle"
      :aria-label="t('subgraphInputValues.locateSource')"
      @click="emit('locate', upstream)"
    >
      <span>{{
        t('subgraphInputValues.fromSource', {
          title: upstream.title,
          id: upstream.id
        })
      }}</span>
      <i
        v-if="owner?.shared"
        role="img"
        class="icon-[lucide--link] size-3"
        :aria-label="t('subgraphInputValues.sharedSource')"
      />
    </button>
    <div
      class="flex min-h-0 min-w-0 flex-1 flex-col self-stretch"
      :inert="canvasStore.isReadOnly"
    >
      <WidgetGrid
        v-if="owner && widgets.length"
        :key="owner.widgetId"
        :processed-widgets="widgets"
        :node-id="owner.node.id"
        :node-type="owner.node.type"
        :node-title="owner.node.title"
        :sync-layout="false"
      />
      <div
        v-else-if="!isAddPort"
        class="mx-3 flex h-(--node-widget-height) min-w-0 items-center gap-2 rounded-(--node-widget-radius) bg-input/50 px-3"
      >
        <span class="truncate">{{ label }}</span>
        <span
          v-if="status"
          class="ml-auto truncate text-muted-foreground italic"
          >{{ status }}</span
        >
      </div>
    </div>
    <div
      data-port-anchor
      :data-testid="isAddPort ? 'subgraph-add-input' : 'subgraph-input-port'"
      :aria-label="isAddPort ? undefined : label"
      :class="
        cn(
          'lg-slot lg-slot--output flex h-(--node-widget-height) w-4 shrink-0 cursor-crosshair items-center justify-center',
          dimmed && 'opacity-40'
        )
      "
      @pointerdown="forwardEventToCanvas"
      @pointermove="forwardEventToCanvas"
      @pointerup="forwardEventToCanvas"
      @dblclick="forwardEventToCanvas"
      @contextmenu.prevent
    >
      <SlotConnectionDot :slot-data="port" />
    </div>
  </div>
</template>
