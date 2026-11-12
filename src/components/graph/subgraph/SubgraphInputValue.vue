<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { InputValueSource } from '@/core/graph/subgraph/resolveInputValueSource'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useSubgraphInputWidget } from './useSubgraphInputWidget'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import Button from '@comfyorg/design-system/button/Button'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { cn } from '@comfyorg/tailwind-utils'

const { label, resolve, host } = defineProps<{
  label: string
  resolve: () => InputValueSource
  host: NodeState
}>()
const emit = defineEmits<{ locate: [node: NodeState] }>()
const { t } = useI18n()
const canvasStore = useCanvasStore()
const { source, upstream, owner, widgets, expands } = useSubgraphInputWidget(
  resolve,
  () => host
)
</script>

<template>
  <div :class="cn('flex min-w-0 flex-col gap-1', expands && 'min-h-0 flex-1')">
    <div
      v-if="upstream"
      class="mx-3 flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span
        class="min-w-0 flex-1 wrap-anywhere"
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
        v-if="owner?.shared"
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
    <div
      class="flex min-h-0 min-w-0 flex-1 flex-col"
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
      <p v-else class="m-0 text-xs text-muted-foreground">
        {{ label }}:
        {{
          source.kind === 'linked'
            ? t('subgraphInputValues.linked')
            : t('subgraphInputValues.unavailable')
        }}
      </p>
    </div>
  </div>
</template>
