<script setup lang="ts">
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { CSSProperties } from 'vue'
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
  mediaClass: string
  hasCustomContent: boolean
  previewUrl?: string
  progress?: number
  progressClasses: string
  progressStyle: CSSProperties
}>()
</script>

<template>
  <div class="relative">
    <div
      v-if="progress !== undefined"
      :class="progressClasses"
      :style="progressStyle"
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

    <div v-if="hasCustomContent" :class="mediaClass">
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
