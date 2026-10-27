<template>
  <div v-if="renderError" class="node-error p-4 text-destructive">
    {{ st('nodeErrors.header', 'Node Header Error') }}
  </div>
  <div
    v-else
    :class="cn('lg-node-header w-full min-w-0 p-1 text-xs', headerShapeClass)"
    :data-testid="`node-header-${nodeData?.id || ''}`"
    @dblclick="handleDoubleClick"
  >
    <div class="flex min-w-0 items-center justify-between gap-1">
      <!-- Collapse/Expand Button -->
      <div class="relative mr-auto flex min-w-0 items-center gap-1">
        <div class="flex shrink-0 items-center px-0.5">
          <Button
            size="icon-sm"
            variant="textonly"
            class="text-inherit hover:bg-transparent"
            data-testid="node-collapse-button"
            @click.stop="handleCollapse"
            @dblclick.stop
          >
            <i
              :class="
                cn(
                  'icon-[lucide--chevron-down] transition-transform',
                  collapsed && '-rotate-90'
                )
              "
            />
          </Button>
        </div>
        <Tooltip :disabled="!tooltipText">
          <TooltipTrigger as-child>
            <div
              class="flex min-w-0 flex-1 items-center gap-2"
              data-testid="node-title"
            >
              <div class="flex-1 truncate">
                <EditableText
                  :model-value="displayTitle"
                  :is-editing="isEditing"
                  :input-attrs="{ 'data-testid': 'node-title-input' }"
                  @edit="handleTitleEdit"
                  @cancel="handleTitleCancel"
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>{{ tooltipText }}</TooltipContent>
        </Tooltip>
      </div>

      <CreditBadge
        v-for="badge in priceBadges ?? []"
        :key="badge.required"
        :text="badge.required"
        :rest="badge.rest"
      />
      <NodeBadge v-if="statusBadge" v-bind="statusBadge" />
      <i
        v-if="isPinned"
        class="icon-[comfy--pin]"
        data-testid="node-pin-indicator"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref } from 'vue'

import EditableText from '@comfyorg/design-system/common/EditableText'
import CreditBadge from '@comfyorg/design-system/badge/CreditBadge'
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import type { NodeState } from '@/types/nodeState'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { st } from '@/i18n'
import { LGraphEventMode, RenderShape } from '@/lib/litegraph/src/litegraph'
import NodeBadge from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { useNodeTooltips } from '@/renderer/extensions/vueNodes/composables/useNodeTooltips'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { cn } from '@comfyorg/tailwind-utils'

import type { NodeBadgeProps } from './NodeBadge.vue'

interface NodeHeaderProps {
  nodeData?: NodeState
  collapsed?: boolean
  priceBadges?: { required: string; rest?: string }[]
}

const { nodeData, collapsed } = defineProps<NodeHeaderProps>()

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

const { getNodeDescription } = useNodeTooltips(nodeData?.type || '')

const tooltipText = computed(() =>
  isEditing.value ? '' : getNodeDescription.value
)

const resolveTitle = (info: NodeState | undefined) => {
  const untitledLabel = st('g.untitled', 'Untitled')
  return resolveNodeDisplayName(info ?? null, {
    emptyLabel: untitledLabel,
    untitledLabel
  })
}

const displayTitle = computed(() => resolveTitle(nodeData))

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

const isPinned = computed(() => Boolean(nodeData?.flags.pinned))

const headerShapeClass = computed(() => {
  if (collapsed) {
    switch (nodeData?.shape) {
      case RenderShape.BOX:
        return 'rounded-none'
      case RenderShape.CARD:
        return 'rounded-tl-xl rounded-br-xl rounded-tr-none rounded-bl-none'
      default:
        return 'rounded-xl'
    }
  }
  switch (nodeData?.shape) {
    case RenderShape.BOX:
      return 'rounded-t-none'
    case RenderShape.CARD:
      return 'rounded-tl-xl rounded-tr-none'
    default:
      return 'rounded-t-xl'
  }
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
</script>
