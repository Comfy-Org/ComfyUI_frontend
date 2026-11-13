<script setup lang="ts">
import { omit } from 'es-toolkit'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { cn } from '@comfyorg/tailwind-utils'
import SubgraphIoLabel from './SubgraphIoLabel.vue'
import SubgraphIoPort from './SubgraphIoPort.vue'

const {
  port,
  label,
  isAddPort = false,
  collapsed = false,
  host,
  source
} = defineProps<{
  port: SubgraphInput
  label: string
  isAddPort?: boolean
  collapsed?: boolean
  host?: NodeState
  source?: InputValueSource
}>()
const emit = defineEmits<{ locate: [node: NodeState] }>()
const { t } = useI18n()
const canvasStore = useCanvasStore()

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
      cn('relative flex min-w-0 items-center', expands && 'min-h-0 flex-1')
    "
  >
    <button
      v-if="upstream"
      type="button"
      class="absolute top-1/2 right-full mr-0.5 flex -translate-y-1/2 cursor-pointer items-center gap-1 rounded-sm border-none bg-transparent px-1 py-0.5 text-2xs whitespace-nowrap text-muted-foreground hover:text-foreground"
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
      <SubgraphIoLabel v-else-if="!isAddPort" :label :status />
    </div>
    <SubgraphIoPort
      :port
      :data-testid="isAddPort ? 'subgraph-add-input' : 'subgraph-input-port'"
      :aria-label="isAddPort ? undefined : label"
    />
  </div>
</template>
