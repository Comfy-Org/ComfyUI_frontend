<template>
  <div v-if="renderError" class="node-error p-4 text-sm text-red-500">
    {{ st('nodeErrors.header', 'Node Header Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-header py-2 pl-2 pr-3 text-sm rounded-t-2xl w-full min-w-50',
        'text-node-component-header bg-node-component-header-surface',
        collapsed && 'rounded-2xl'
      )
    "
    :style="headerStyle"
    :data-testid="`node-header-${nodeData?.id || ''}`"
    @dblclick="handleDoubleClick"
  >
    <div class="flex items-center justify-between gap-2.5">
      <!-- Collapse/Expand Button -->
      <div class="relative grow-1 flex items-center gap-2.5">
        <div class="lod-toggle flex shrink-0 items-center px-0.5">
          <IconButton
            size="fit-content"
            type="transparent"
            data-testid="node-collapse-button"
            @click.stop="handleCollapse"
            @dblclick.stop
          >
            <i
              :class="
                cn(
                  'icon-[lucide--chevron-down] size-5 transition-transform',
                  collapsed && '-rotate-90'
                )
              "
              class="relative top-px text-xs leading-none text-node-component-header-icon"
            ></i>
          </IconButton>
        </div>

        <div v-if="isSubgraphNode" class="icon-[comfy--workflow] size-4" />
        <div v-if="isApiNode" class="icon-[lucide--dollar-sign] size-4" />

        <!-- Node Title -->
        <div
          v-tooltip.top="tooltipConfig"
          class="lod-toggle grow-1 items-center gap-2 truncate text-sm font-bold w-15"
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

      <div class="lod-toggle flex shrink-0 items-center justify-between gap-2">
        <NodeBadge
          v-for="badge of nodeBadges"
          :key="badge.text"
          v-bind="badge"
        />
        <NodeBadge v-if="statusBadge" v-bind="statusBadge" />
        <i-comfy:pin
          v-if="isPinned"
          class="size-5"
          data-testid="node-pin-indicator"
        />
        <IconButton
          v-if="isSubgraphNode"
          v-tooltip.top="enterSubgraphTooltipConfig"
          type="transparent"
          data-testid="subgraph-enter-button"
          class="size-5"
          @click.stop="handleEnterSubgraph"
          @dblclick.stop
        >
          <i
            class="icon-[lucide--picture-in-picture] size-5 text-node-component-header-icon"
          ></i>
        </IconButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, toValue, watch } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import EditableText from '@/components/common/EditableText.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import NodeBadge from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { app } from '@/scripts/app'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { normalizeI18nKey } from '@/utils/formatUtil'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { cn } from '@/utils/tailwindUtil'

import LODFallback from './LODFallback.vue'
import type { NodeBadgeProps } from './NodeBadge.vue'

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

const bypassed = computed(
  (): boolean => nodeData?.mode === LGraphEventMode.BYPASS
)
const muted = computed((): boolean => nodeData?.mode === LGraphEventMode.NEVER)

const statusBadge = computed((): NodeBadgeProps | undefined =>
  muted.value
    ? { text: 'Muted', cssIcon: 'icon-[lucide--ban]' }
    : bypassed.value
      ? { text: 'Bypassed', cssIcon: 'icon-[lucide--redo-dot]' }
      : undefined
)

const nodeBadges = computed<NodeBadgeProps[]>(() =>
  [...(nodeData?.badges ?? [])].map(toValue)
)
const isPinned = computed(() => Boolean(nodeData?.flags?.pinned))
const isApiNode = computed(() => Boolean(nodeData?.apiNode))
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
