<template>
  <div v-if="renderError" class="node-error p-4 text-red-500 text-sm">
    {{ $t('Node Header Error') }}
  </div>
  <div
    v-else
    class="lg-node-header flex items-center justify-between p-4 rounded-t-2xl cursor-move w-full"
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
        class="text-xs leading-none relative top-px text-stone-200 dark-theme:text-slate-300"
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

    <!-- Title Buttons -->
    <div v-if="!readonly" class="flex items-center">
      <IconButton
        v-if="isSubgraphNode"
        size="sm"
        type="transparent"
        class="text-stone-200 dark-theme:text-slate-300"
        data-testid="subgraph-enter-button"
        title="Enter Subgraph"
        @click="handleEnterSubgraph"
        @dblclick.stop
      >
        <i class="pi pi-external-link"></i>
      </IconButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import EditableText from '@/components/common/EditableText.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LODLevel } from '@/renderer/extensions/vueNodes/lod/useLOD'
import { app } from '@/scripts/app'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'

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

const nodeInfo = computed(() => props.nodeData || props.node)

const resolveTitle = (info: LGraphNode | VueNodeData | undefined) => {
  const title = (info?.title ?? '').trim()
  if (title.length > 0) return title
  const type = (info?.type ?? '').trim()
  return type.length > 0 ? type : 'Untitled'
}

// Local state for title to provide immediate feedback
const displayTitle = ref(resolveTitle(nodeInfo.value))

// Watch for external changes to the node title or type
watch(
  () => [nodeInfo.value?.title, nodeInfo.value?.type] as const,
  () => {
    const next = resolveTitle(nodeInfo.value)
    if (next !== displayTitle.value) {
      displayTitle.value = next
    }
  }
)

// Subgraph detection
const isSubgraphNode = computed(() => {
  if (!nodeInfo.value?.id) return false

  // Get the underlying LiteGraph node
  const graph = app.graph?.rootGraph || app.graph
  if (!graph) return false

  const locatorId = getLocatorIdFromNodeData(nodeInfo.value)

  const litegraphNode = getNodeByLocatorId(graph, locatorId)

  // Use the official type guard method
  return litegraphNode?.isSubgraphNode() ?? false
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
}

const handleEnterSubgraph = (event: Event) => {
  event.stopPropagation()
  emit('enter-subgraph')
}
</script>
