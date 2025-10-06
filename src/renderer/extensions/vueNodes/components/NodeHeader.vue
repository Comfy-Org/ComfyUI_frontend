<template>
  <div v-if="renderError" class="node-error p-4 text-red-500 text-sm">
    {{ $t('Node Header Error') }}
  </div>
  <div
    v-else
    class="lg-node-header p-4 rounded-t-2xl cursor-move w-full"
    :style="headerStyle"
    :data-testid="`node-header-${nodeData?.id || ''}`"
    @dblclick="handleDoubleClick"
  >
    <div class="flex items-center justify-between gap-2.5 relative">
      <!-- Collapse/Expand Button -->
      <button
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
        class="text-sm font-bold truncate flex-1 lod-toggle flex items-center gap-2"
        data-testid="node-title"
      >
        <EditableText
          :model-value="displayTitle"
          :is-editing="isEditing"
          :input-attrs="{ 'data-testid': 'node-title-input' }"
          @edit="handleTitleEdit"
          @cancel="handleTitleCancel"
        />
        <i-lucide:pin
          v-if="isPinned"
          class="w-5 h-5 text-stone-200 dark-theme:text-slate-300"
          data-testid="node-pin-indicator"
        />
      </div>
      <div class="flex items-center lod-toggle shrink-0">
        <IconButton
          v-if="isSubgraphNode"
          v-tooltip.top="enterSubgraphTooltipConfig"
          size="sm"
          type="transparent"
          class="text-stone-200 dark-theme:text-slate-300"
          data-testid="subgraph-enter-button"
          @click.stop="handleEnterSubgraph"
          @dblclick.stop
        >
          <i class="pi pi-external-link"></i>
        </IconButton>
      </div>
      <LODFallback />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import EditableText from '@/components/common/EditableText.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { app } from '@/scripts/app'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'

import LODFallback from './LODFallback.vue'

interface NodeHeaderProps {
  nodeData?: VueNodeData
  collapsed?: boolean
}

const { nodeData, collapsed } = defineProps<NodeHeaderProps>()

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

const { getNodeDescription, createTooltipConfig } = useNodeTooltips(
  nodeData?.type || ''
)

const tooltipConfig = computed(() => {
  if (isEditing.value) {
    return { value: '', disabled: true }
  }
  const description = getNodeDescription.value
  return createTooltipConfig(description)
})

const enterSubgraphTooltipConfig = computed(() => {
  return createTooltipConfig(st('enterSubgraph', 'Enter Subgraph'))
})

const headerStyle = computed(() => {
  const colorPaletteStore = useColorPaletteStore()

  const opacity = useSettingStore().get('Comfy.Node.Opacity') ?? 1

  if (!nodeData?.color) {
    return { backgroundColor: '', opacity }
  }

  const headerColor = applyLightThemeColor(
    nodeData.color,
    Boolean(colorPaletteStore.completedActivePalette.light_theme)
  )

  return { backgroundColor: headerColor, opacity }
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

const isPinned = computed(() => Boolean(nodeData?.flags?.pinned))

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
  isEditing.value = true
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
