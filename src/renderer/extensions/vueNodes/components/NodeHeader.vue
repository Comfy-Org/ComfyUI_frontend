<template>
  <div v-if="renderError" class="node-error p-4 text-red-500 text-sm">
    {{ $t('Node Header Error') }}
  </div>
  <div
    v-else
    class="lg-node-header flex items-center justify-between p-4 rounded-t-2xl cursor-move"
    :data-testid="`node-header-${nodeInfo?.id || ''}`"
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
        class="text-xs leading-none relative top-[1px] text-[#888682] dark-theme:text-[#5B5E7D]"
      ></i>
    </button>

    <!-- Node Title -->
    <div class="text-sm font-bold truncate flex-1" data-testid="node-title">
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
