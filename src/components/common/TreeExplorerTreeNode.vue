<template>
  <div
    ref="container"
    :class="
      cn(
        'tree-node flex w-full items-center justify-between rounded-sm',
        canDrop && 'ring-1 ring-base-foreground ring-inset'
      )
    "
    :data-testid="`tree-node-${node.key}`"
  >
    <div class="node-content flex min-w-0 flex-1 items-center">
      <span class="node-label block min-w-0 truncate">
        <slot name="before-label" :node="node" />
        <EditableText
          :model-value="node.label"
          :is-editing="isEditing"
          @edit="handleRename"
        />
        <slot name="after-label" :node="node" />
      </span>
      <Badge
        v-if="showNodeBadgeText"
        variant="badge"
        severity="secondary"
        class="ml-2"
        data-testid="tree-leaf-count"
      >
        {{ nodeBadgeText }}
      </Badge>
    </div>
    <div
      class="node-actions flex gap-1 motion-safe:opacity-0 motion-safe:group-focus-within/tree-node:opacity-100 motion-safe:group-hover/tree-node:opacity-100 touch:opacity-100"
    >
      <slot name="actions" :node="node" />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { computed, inject, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import EditableText from '@/components/common/EditableText.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import {
  usePragmaticDraggable,
  usePragmaticDroppable
} from '@/composables/usePragmaticDragAndDrop'
import {
  InjectKeyExpandedKeys,
  InjectKeyHandleEditLabelFunction
} from '@/types/treeExplorerTypes'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerDragAndDropData
} from '@/types/treeExplorerTypes'

const { node } = defineProps<{
  node: RenderedTreeExplorerNode<T>
}>()

const emit = defineEmits<{
  (e: 'dragStart', node: RenderedTreeExplorerNode<T>): void
  (e: 'dragEnd', node: RenderedTreeExplorerNode<T>): void
}>()

const nodeBadgeText = computed<string>(() => {
  if (node.leaf) {
    return ''
  }
  if (node.badgeText !== undefined && node.badgeText !== null) {
    return node.badgeText
  }
  return node.totalLeaves.toString()
})
const showNodeBadgeText = computed<boolean>(() => nodeBadgeText.value !== '')

const isEditing = computed<boolean>(() => node.isEditingLabel ?? false)
const handleEditLabel = inject(InjectKeyHandleEditLabelFunction)
const expandedKeys = inject(InjectKeyExpandedKeys)
const handleRename = (newName: string) => {
  handleEditLabel?.(node as RenderedTreeExplorerNode, newName)
}

const container = ref<HTMLElement | null>(null)
const canDrop = ref(false)

const treeNodeElementGetter = () =>
  container.value?.closest<HTMLElement>('.tree-explorer-item') ?? null

if (node.draggable) {
  usePragmaticDraggable(treeNodeElementGetter, {
    getInitialData: () => {
      return {
        type: 'tree-explorer-node',
        data: node
      }
    },
    onDragStart: () => emit('dragStart', node),
    onDrop: () => emit('dragEnd', node),
    onGenerateDragPreview: node.renderDragPreview
      ? ({ nativeSetDragImage }) => {
          setCustomNativeDragPreview({
            render: ({ container }) => {
              return node.renderDragPreview?.(container)
            },
            nativeSetDragImage
          })
        }
      : undefined
  })
}

if (node.droppable) {
  usePragmaticDroppable(treeNodeElementGetter, {
    onDrop: async (event) => {
      const dndData = event.source.data as TreeExplorerDragAndDropData
      if (dndData.type === 'tree-explorer-node') {
        await node.handleDrop?.(dndData as TreeExplorerDragAndDropData<T>)
        canDrop.value = false
        if (expandedKeys) {
          expandedKeys.value = { ...expandedKeys.value, [node.key]: true }
        }
      }
    },
    onDragEnter: (event) => {
      const dndData = event.source.data as TreeExplorerDragAndDropData
      if (dndData.type === 'tree-explorer-node') {
        canDrop.value = true
      }
    },
    onDragLeave: () => {
      canDrop.value = false
    }
  })
}
</script>
