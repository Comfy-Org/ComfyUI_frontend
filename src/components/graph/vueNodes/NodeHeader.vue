<template>
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Header Error
  </div>
  <div
    v-else
    class="lg-node-header flex items-center justify-between px-3 py-2 rounded-t cursor-move"
    :style="{
      backgroundColor: headerColor,
      color: textColor
    }"
    @dblclick="handleDoubleClick"
  >
    <!-- Node Title -->
    <span class="text-sm font-medium truncate flex-1">
      {{ nodeInfo?.title || 'Untitled' }}
    </span>

    <!-- Node Controls -->
    <div class="flex items-center gap-1 ml-2">
      <!-- Collapse/Expand Button -->
      <button
        v-if="!readonly"
        class="lg-node-header__control p-0.5 rounded hover:bg-white/20 dark-theme:hover:bg-black/20 transition-colors opacity-60 hover:opacity-100"
        title="Toggle collapse"
        @click.stop="handleCollapse"
      >
        <svg
          class="w-3 h-3 transition-transform"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <!-- Additional controls can be added here -->
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LGraphNode } from '@comfyorg/litegraph'
import { computed, onErrorCaptured, ref } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { LODLevel } from '@/composables/graph/useLOD'
import { useErrorHandling } from '@/composables/useErrorHandling'

interface NodeHeaderProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
  lodLevel?: LODLevel
}

const props = defineProps<NodeHeaderProps>()

const emit = defineEmits<{
  collapse: []
  'title-edit': []
}>()

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

const nodeInfo = computed(() => props.nodeData || props.node)

// Compute header color based on node color property or type
const headerColor = computed(() => {
  const info = nodeInfo.value
  if (!info) return '#353535'

  if (info.mode === 4) return '#666' // Bypassed
  if (info.mode === 2) return '#444' // Muted
  return '#353535' // Default
})

// Compute text color for contrast
const textColor = computed(() => {
  const color = headerColor.value
  if (!color || color === '#353535' || color === '#444' || color === '#666') {
    return '#fff'
  }
  const colorStr = String(color)
  const rgb = parseInt(
    colorStr.startsWith('#') ? colorStr.slice(1) : colorStr,
    16
  )
  const r = (rgb >> 16) & 255
  const g = (rgb >> 8) & 255
  const b = rgb & 255
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? '#000' : '#fff'
})

// Event handlers
const handleCollapse = () => {
  emit('collapse')
}

const handleDoubleClick = () => {
  if (!props.readonly) {
    emit('title-edit')
  }
}
</script>
