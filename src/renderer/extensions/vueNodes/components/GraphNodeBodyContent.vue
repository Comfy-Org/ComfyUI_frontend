<script setup lang="ts">
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { cn } from '@comfyorg/tailwind-utils'
import type { ClassValue } from '@comfyorg/tailwind-utils'
import type { PromotedPreview } from '@/composables/node/usePromotedPreviews'
import type { NodeMedia } from '@/renderer/extensions/vueNodes/types/nodeMedia'
import type { ProcessedWidgetModel } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import NodeBody from './NodeBody.vue'
import NodeContent from './NodeContent.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'
import LivePreview from './LivePreview.vue'
defineProps<{
  nodeData: NodeState
  hasRenderableWidgets: boolean
  processedWidgetModel: ProcessedWidgetModel
  bodyRoundingClass: ClassValue
  media?: NodeMedia
  previews: PromotedPreview[]
  hasExpandingWidget: boolean
  hasCustomContent: boolean
  previewUrl?: string
  progress?: number
  progressClasses: ClassValue
}>()
</script>

<template>
  <template v-if="nodeData.type === 'Reroute'">
    <NodeSlots :node-data />
  </template>

  <template v-else>
    <div class="relative">
      <div
        v-if="progress !== undefined"
        :class="
          cn(
            'absolute inset-x-0 top-1/2 -translate-y-1/2',
            !!(progress < 1) && 'rounded-r-full',
            progressClasses
          )
        "
        :style="{ width: `${Math.min(progress * 100, 100)}%` }"
      />
    </div>

    <NodeBody
      :class="bodyRoundingClass"
      :data-testid="`node-body-${nodeData.id}`"
    >
      <NodeSlots :node-data />

      <NodeWidgets
        v-if="hasRenderableWidgets"
        :node-data
        :processed-widget-model
      />

      <div
        v-if="hasCustomContent"
        :class="
          cn(
            'flex min-h-0 flex-col',
            media?.type === 'image' && hasExpandingWidget
              ? 'shrink-0'
              : 'flex-1'
          )
        "
      >
        <NodeContent v-if="media" :node-data :media="media" />
        <NodeContent
          v-for="preview in previews"
          :key="`${preview.sourceNodeId}-${preview.sourceWidgetName}`"
          :node-data
          :media="preview"
        />
      </div>
      <LivePreview v-if="previewUrl !== undefined" :image-url="previewUrl" />
    </NodeBody>
  </template>
</template>
