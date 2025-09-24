<template>
  <div
    ref="nodeContainerRef"
    :data-node-id="nodeData?.id"
    :class="containerClasses"
    :style="containerStyle"
    v-bind="eventHandlers"
  >
    <div class="flex items-center">
      <template v-if="isCollapsed">
        <SlotConnectionDot multi class="absolute left-0 -translate-x-1/2" />
        <SlotConnectionDot multi class="absolute right-0 translate-x-1/2" />
      </template>
      <!-- Header only updates on title/color changes -->
      <NodeHeader
        v-memo="[nodeData?.title, isCollapsed]"
        :node-data="nodeData"
        :readonly="readonly"
        :collapsed="isCollapsed"
        @collapse="emit('collapse')"
        @update:title="emit('update:title', $event)"
        @enter-subgraph="emit('enter-subgraph')"
      />
    </div>

    <div
      v-if="isCollapsed && showProgress"
      :class="progressBarClasses"
      :style="progressBarStyle"
    />

    <template v-if="!isCollapsed">
      <div class="mb-4 relative">
        <div :class="separatorClasses" />
        <!-- Progress bar for executing state -->
        <div
          v-if="showProgress"
          :class="
            cn(
              'absolute inset-x-0 top-1/2 -translate-y-1/2',
              !!(progressValue && progressValue < 1) && 'rounded-r-full',
              progressClasses
            )
          "
          :style="progressStyle"
        />
      </div>

      <!-- Node Body - rendered based on LOD level and collapsed state -->
      <div
        class="flex flex-col gap-4 pb-4"
        :data-testid="`node-body-${nodeData?.id}`"
      >
        <!-- Slots only rendered at full detail -->
        <NodeSlots
          v-memo="[nodeData?.inputs?.length, nodeData?.outputs?.length]"
          :node-data="nodeData"
          :readonly="readonly"
        />

        <!-- Widgets rendered at reduced+ detail -->
        <NodeWidgets
          v-if="nodeData?.widgets?.length"
          v-memo="[nodeData?.widgets?.length]"
          :node-data="nodeData"
          :readonly="readonly"
        />

        <!-- Custom content at reduced+ detail -->
        <NodeContent
          v-if="hasCustomContent"
          :node-data="nodeData"
          :readonly="readonly"
          :image-urls="imageUrls"
        />
        <!-- Live preview image -->
        <div
          v-if="showPreviewImage && previewImageUrl"
          v-memo="[previewImageUrl]"
          class="px-4"
        >
          <img
            :src="previewImageUrl"
            alt="preview"
            class="w-full max-h-64 object-contain"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { provide, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { cn } from '@/utils/tailwindUtil'

import NodeContent from './NodeContent.vue'
import NodeHeader from './NodeHeader.vue'
import NodeSlots from './NodeSlots.vue'
import NodeWidgets from './NodeWidgets.vue'
import SlotConnectionDot from './SlotConnectionDot.vue'

interface NodeBaseTemplateProps {
  nodeData?: VueNodeData
  readonly?: boolean
  // Presentation state
  containerClasses?: string
  containerStyle?: any
  isCollapsed?: boolean
  separatorClasses?: string
  progressClasses?: string
  progressBarClasses?: string
  // Progress state
  showProgress?: boolean
  progressValue?: number
  progressStyle?: any
  progressBarStyle?: any
  // Content state
  hasCustomContent?: boolean
  imageUrls?: string[]
  showPreviewImage?: boolean
  previewImageUrl?: string
  // Event handlers object for v-bind
  eventHandlers?: Record<string, any>
}

const {
  nodeData,
  readonly = false,
  containerClasses = '',
  containerStyle = {},
  isCollapsed = false,
  separatorClasses = '',
  progressClasses = '',
  progressBarClasses = '',
  showProgress = false,
  progressValue,
  progressStyle,
  progressBarStyle,
  hasCustomContent = false,
  imageUrls = [],
  showPreviewImage = false,
  previewImageUrl,
  eventHandlers = {}
} = defineProps<NodeBaseTemplateProps>()

const emit = defineEmits<{
  collapse: []
  'update:title': [newTitle: string]
  'enter-subgraph': []
}>()

// Provide tooltip container for child components
const nodeContainerRef = ref<HTMLElement>()
provide('tooltipContainer', nodeContainerRef)
</script>
