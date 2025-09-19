<template>
  <div v-if="renderError" class="node-error p-4 text-red-500 text-sm">
    {{ $t('Node Header Error') }}
  </div>
  <div
    v-else
    class="lg-node-header flex items-center justify-between p-4 rounded-t-2xl cursor-move"
    :data-testid="`node-header-${nodeData?.id || ''}`"
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
        class="text-xs leading-none relative top-px text-stone-200 dark-theme:text-slate-300"
      ></i>
    </button>

    <!-- Node Title -->
    <div
      v-tooltip.top="tooltipConfig"
      class="text-sm font-bold truncate flex-1"
      data-testid="node-title"
    >
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
import { type Ref, computed, inject, onErrorCaptured, ref, watch } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import type { LODLevel } from '@/renderer/extensions/vueNodes/lod/useLOD'

interface NodeHeaderProps {
  nodeData?: VueNodeData
  readonly?: boolean
  lodLevel?: LODLevel
  collapsed?: boolean
}

const { nodeData, readonly, collapsed } = defineProps<NodeHeaderProps>()

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

const tooltipContainer =
  inject<Ref<HTMLElement | undefined>>('tooltipContainer')
const { getNodeDescription, createTooltipConfig } = useNodeTooltips(
  nodeData?.type || '',
  tooltipContainer
)

const tooltipConfig = computed(() => {
  if (readonly || isEditing.value) {
    return { value: '', disabled: true }
  }
  const description = getNodeDescription.value
  return createTooltipConfig(description)
})

const resolveTitle = (info: VueNodeData | undefined) => {
  const title = (info?.title ?? '').trim()
  if (title.length > 0) return title
  const type = (info?.type ?? '').trim()
  return type.length > 0 ? type : 'Untitled'
}

// Local state for title to provide immediate feedback
const displayTitle = ref(resolveTitle(nodeData))

// Watch for external changes to the node title or type
watch(
  () => [nodeData?.title, nodeData?.type] as const,
  () => {
    const next = resolveTitle(nodeData)
    if (next !== displayTitle.value) {
      displayTitle.value = next
    }
  }
)

// Event handlers
const handleCollapse = () => {
  emit('collapse')
}

const handleDoubleClick = () => {
  if (!readonly) {
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
}
</script>
