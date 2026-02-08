<template>
  <div v-if="renderError" class="node-error p-4 text-red-500">
    {{ st('nodeErrors.header', 'Node Header Error') }}
  </div>
  <div
    v-else
    :class="
      cn(
        'lg-node-header text-sm py-2 pl-2 pr-3 w-full min-w-0',
        'text-node-component-header bg-node-component-header-surface',
        headerShapeClass
      )
    "
    :style="{
      backgroundColor: applyLightThemeColor(nodeData?.color),
      opacity: useSettingStore().get('Comfy.Node.Opacity') ?? 1
    }"
    :data-testid="`node-header-${nodeData?.id || ''}`"
    @dblclick="handleDoubleClick"
  >
    <div class="flex items-center justify-between gap-2.5 min-w-0">
      <!-- Collapse/Expand Button -->
      <div class="relative grow-1 flex items-center gap-2.5 min-w-0 flex-1">
        <div class="flex shrink-0 items-center px-0.5">
          <Button
            size="icon-sm"
            variant="textonly"
            class="hover:bg-transparent"
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
              class="text-node-component-header-icon"
            />
          </Button>
        </div>

        <div v-if="isSubgraphNode" class="icon-[comfy--workflow] size-4" />
        <div v-if="isApiNode" class="icon-[lucide--component] size-4" />

        <!-- Node Title -->
        <div
          v-tooltip.top="tooltipConfig"
          class="flex min-w-0 flex-1 items-center gap-2"
          data-testid="node-title"
        >
          <div class="truncate min-w-0 flex-1">
            <EditableText
              :model-value="displayTitle"
              :is-editing="isEditing"
              :input-attrs="{ 'data-testid': 'node-title-input' }"
              @edit="handleTitleEdit"
              @cancel="handleTitleCancel"
            />
          </div>
        </div>
      </div>

      <div class="flex shrink-0 items-center justify-between gap-2">
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
        <Button
          v-if="isSubgraphNode"
          v-tooltip.top="enterSubgraphTooltipConfig"
          variant="textonly"
          size="sm"
          data-testid="subgraph-enter-button"
          class="text-node-component-header h-5 px-0.5"
          @click.stop="handleEnterSubgraph"
          @dblclick.stop
        >
          <span>{{ $t('g.edit') }}</span>
          <i class="icon-[lucide--scaling] size-5" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, toValue, watch } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import Button from '@/components/ui/button/Button.vue'
import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePricing } from '@/composables/node/useNodePricing'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { LGraphEventMode, RenderShape } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import NodeBadge from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { applyLightThemeColor } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { app } from '@/scripts/app'
import {
  getLocatorIdFromNodeData,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { cn } from '@/utils/tailwindUtil'

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

const resolveTitle = (info: VueNodeData | undefined) => {
  const untitledLabel = st('g.untitled', 'Untitled')
  return resolveNodeDisplayName(info ?? null, {
    emptyLabel: untitledLabel,
    untitledLabel,
    st
  })
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

// Use per-node pricing revision to re-compute badges only when this node's pricing updates
const {
  getRelevantWidgetNames,
  hasDynamicPricing,
  getInputGroupPrefixes,
  getInputNames,
  getNodeRevisionRef
} = useNodePricing()
// Cache pricing metadata (won't change during node lifetime)
const isDynamicPricing = computed(() =>
  nodeData?.apiNode ? hasDynamicPricing(nodeData.type) : false
)
const relevantPricingWidgets = computed(() =>
  nodeData?.apiNode ? getRelevantWidgetNames(nodeData.type) : []
)
const inputGroupPrefixes = computed(() =>
  nodeData?.apiNode ? getInputGroupPrefixes(nodeData.type) : []
)
const relevantInputNames = computed(() =>
  nodeData?.apiNode ? getInputNames(nodeData.type) : []
)
const nodeBadges = computed<NodeBadgeProps[]>(() => {
  // For ALL API nodes: access per-node revision ref to detect when async pricing evaluation completes
  // This is needed even for static pricing because JSONata 2.x evaluation is async
  if (nodeData?.apiNode && nodeData?.id != null) {
    // Access per-node revision ref to establish dependency (each node has its own ref)
    void getNodeRevisionRef(nodeData.id).value

    // For dynamic pricing, also track widget values and input connections
    if (isDynamicPricing.value) {
      // Access only the widget values that affect pricing
      const relevantNames = relevantPricingWidgets.value
      if (relevantNames.length > 0) {
        nodeData?.widgets?.forEach((w) => {
          if (relevantNames.includes(w.name)) w.value
        })
      }
      // Access input connections for regular inputs
      const inputNames = relevantInputNames.value
      if (inputNames.length > 0) {
        nodeData?.inputs?.forEach((inp) => {
          if (inp.name && inputNames.includes(inp.name)) {
            void inp.link // Access link to create reactive dependency
          }
        })
      }
      // Access input connections for input_groups (e.g., autogrow inputs)
      const groupPrefixes = inputGroupPrefixes.value
      if (groupPrefixes.length > 0) {
        nodeData?.inputs?.forEach((inp) => {
          if (
            groupPrefixes.some((prefix) => inp.name?.startsWith(`${prefix}.`))
          ) {
            void inp.link // Access link to create reactive dependency
          }
        })
      }
    }
  }
  return [...(nodeData?.badges ?? [])].map(toValue)
})
const isPinned = computed(() => Boolean(nodeData?.flags?.pinned))
const isApiNode = computed(() => Boolean(nodeData?.apiNode))

const headerShapeClass = computed(() => {
  if (collapsed) {
    switch (nodeData?.shape) {
      case RenderShape.BOX:
        return 'rounded-none'
      case RenderShape.CARD:
        return 'rounded-tl-2xl rounded-br-2xl rounded-tr-none rounded-bl-none'
      default:
        return 'rounded-2xl'
    }
  }
  switch (nodeData?.shape) {
    case RenderShape.BOX:
      return 'rounded-t-none'
    case RenderShape.CARD:
      return 'rounded-tl-2xl rounded-tr-none'
    default:
      return 'rounded-t-2xl'
  }
})

// Subgraph detection
const isSubgraphNode = computed(() => {
  if (!nodeData?.id) return false

  // Get the underlying LiteGraph node
  const graph = app.rootGraph
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
