<template>
  <div v-if="renderError" class="node-error p-4 text-red-500 text-sm">
    {{ $t('Node Header Error') }}
  </div>
  <div
    v-else
    class="lg-node-header p-4 rounded-t-2xl cursor-move"
    :data-testid="`node-header-${nodeData?.id || ''}`"
    @dblclick="handleDoubleClick"
  >
    <div class="flex items-center justify-between relative">
      <!-- Collapse/Expand Button -->
      <button
        v-show="!readonly"
        class="bg-transparent border-transparent flex items-center lod-toggle"
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
        class="text-sm font-bold truncate flex-1 lod-toggle"
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
      <LODFallback />
    </div>

    <!-- Title Buttons -->
    <div v-if="!readonly" class="flex items-center lod-toggle">
      <IconButton
        v-if="isSubgraphNode"
        size="sm"
        type="transparent"
        class="text-stone-200 dark-theme:text-slate-300"
        data-testid="subgraph-enter-button"
        title="Enter Subgraph"
        @click.stop="handleEnterSubgraph"
        @dblclick.stop
      >
        <i class="pi pi-external-link"></i>
      </IconButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Ref, computed, inject, onErrorCaptured, ref, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import EditableText from '@/components/common/EditableText.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { app } from '@/scripts/app'
import { normalizeI18nKey } from '@/utils/formatUtil'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'

import LODFallback from './LODFallback.vue'

interface NodeHeaderProps {
  nodeData?: VueNodeData
  readonly?: boolean
  collapsed?: boolean
}

const { nodeData, readonly, collapsed } = defineProps<NodeHeaderProps>()

const emit = defineEmits<{
  collapse: []
  'update:title': [newTitle: string]
  'enter-subgraph': []
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

  const nodeType = (info?.type ?? '').trim() || 'Untitled'
  const key = `nodeDefs.${normalizeI18nKey(nodeType)}.display_name`
  return st(key, nodeType)
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

// Subgraph detection
const isSubgraphNode = computed(() => {
  if (!nodeData?.id) return false

  // Get the underlying LiteGraph node
  const graph = app.graph?.rootGraph || app.graph
  if (!graph) return false

  const locatorId = getLocatorIdFromNodeData(nodeData)

  const litegraphNode = getNodeByLocatorId(graph, locatorId)

  // Use the official type guard method
  return litegraphNode?.isSubgraphNode() ?? false
})

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

const handleEnterSubgraph = () => {
  emit('enter-subgraph')
}
</script>
