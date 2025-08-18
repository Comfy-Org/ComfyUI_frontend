<template>
  <!-- eslint-disable-next-line @intlify/vue-i18n/no-raw-text -->
  <div v-if="renderError" class="node-error p-2 text-red-500 text-sm">
    ⚠️ Node Header Error
  </div>
  <div
    v-else
    class="lg-node-header flex items-center justify-between p-2 rounded-t-lg cursor-move"
    :data-testid="`node-header-${nodeInfo?.id || ''}`"
    :style="{
      backgroundColor: headerColor,
      color: textColor
    }"
    @dblclick="handleDoubleClick"
  >
    <!-- Collapse/Expand Button -->
    <button
      v-show="!readonly"
      class="bg-transparent border-transparent flex items-center"
      data-testid="node-collapse-button"
      @click.stop="handleCollapse"
      @dblclick.stop
    >
      <i
        :class="collapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-down'"
        class="text-xs leading-none relative top-[1px]"
      ></i>
    </button>

    <!-- Node Title -->
    <div class="text-sm font-medium truncate flex-1" data-testid="node-title">
      <EditableText
        :model-value="displayTitle"
        :is-editing="isEditing"
        :input-attrs="{ 'data-testid': 'node-title-input' }"
        @edit="handleTitleEdit"
        @cancel="handleTitleCancel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LODLevel } from '@/renderer/extensions/vueNodes/lod/useLOD'

interface NodeHeaderProps {
  node?: LGraphNode // For backwards compatibility
  nodeData?: VueNodeData // New clean data structure
  readonly?: boolean
  lodLevel?: LODLevel
  collapsed?: boolean
}

const props = defineProps<NodeHeaderProps>()

const emit = defineEmits<{
  collapse: []
  'update:title': [newTitle: string]
}>()

// Error boundary implementation
const renderError = ref<string | null>(null)
const { toastErrorHandler } = useErrorHandling()

onErrorCaptured((error) => {
  renderError.value = error.message
  toastErrorHandler(error)
  return false
})

// Editing state
const isEditing = ref(false)

const nodeInfo = computed(() => props.nodeData || props.node)

// Local state for title to provide immediate feedback
const displayTitle = ref(nodeInfo.value?.title || 'Untitled')

// Watch for external changes to the node title
watch(
  () => nodeInfo.value?.title,
  (newTitle) => {
    if (newTitle && newTitle !== displayTitle.value) {
      displayTitle.value = newTitle
    }
  }
)

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
    isEditing.value = true
  }
}

const handleTitleEdit = (newTitle: string) => {
  isEditing.value = false
  const trimmedTitle = newTitle.trim()
  if (trimmedTitle && trimmedTitle !== displayTitle.value) {
    // Emit for litegraph sync
    emit('update:title', trimmedTitle)
  }
}

const handleTitleCancel = () => {
  isEditing.value = false
  // Reset displayTitle to the current node title
  displayTitle.value = nodeInfo.value?.title || 'Untitled'
}
</script>
