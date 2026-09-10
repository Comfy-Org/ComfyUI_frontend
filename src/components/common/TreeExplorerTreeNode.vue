<template>
  <div
    ref="container"
    :class="
      cn(
        'tree-node flex w-full items-center justify-between rounded-sm',
        canDrop && 'border border-border-default',
        props.node.leaf ? 'tree-leaf' : 'tree-folder'
      )
    "
    :data-testid="`tree-node-${node.key}`"
  >
    <div class="node-content flex min-w-0 flex-1 items-center">
      <span class="node-label min-w-0">
        <slot name="before-label" :node="props.node" />
        <EditableText
          :model-value="node.label"
          :is-editing="isEditing"
          label-class="break-all"
          @edit="handleRename"
        />
        <slot name="after-label" :node="props.node" />
      </span>
      <Badge
        v-if="showNodeBadgeText"
        :value="nodeBadgeText"
        variant="badge"
        severity="secondary"
        class="ml-2"
      />
    </div>
    <div
      class="node-actions flex gap-1 motion-safe:opacity-0 motion-safe:group-hover/tree-node:opacity-100 touch:opacity-100"
    >
      <slot name="actions" :node="props.node" />
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
import { InjectKeyHandleEditLabelFunction } from '@/types/treeExplorerTypes'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerDragAndDropData
} from '@/types/treeExplorerTypes'

const props = defineProps<{
  node: RenderedTreeExplorerNode<T>
}>()

const emit = defineEmits<{
  (
    e: 'itemDropped',
    node: RenderedTreeExplorerNode<T>,
    data: RenderedTreeExplorerNode<T>
  ): void
  (e: 'dragStart', node: RenderedTreeExplorerNode<T>): void
  (e: 'dragEnd', node: RenderedTreeExplorerNode<T>): void
}>()

const nodeBadgeText = computed<string>(() => {
  if (props.node.leaf) {
    return ''
  }
  if (props.node.badgeText !== undefined && props.node.badgeText !== null) {
    return props.node.badgeText
  }
  return props.node.totalLeaves.toString()
})
const showNodeBadgeText = computed<boolean>(() => nodeBadgeText.value !== '')

const isEditing = computed<boolean>(() => props.node.isEditingLabel ?? false)
const handleEditLabel = inject(InjectKeyHandleEditLabelFunction)
const handleRename = (newName: string) => {
  handleEditLabel?.(props.node as RenderedTreeExplorerNode, newName)
}

const container = ref<HTMLElement | null>(null)
const canDrop = ref(false)

const treeNodeElementGetter = () =>
  container.value?.closest<HTMLElement>('.tree-explorer-item') ?? null

if (props.node.draggable) {
  usePragmaticDraggable(treeNodeElementGetter, {
    getInitialData: () => {
      return {
        type: 'tree-explorer-node',
        data: props.node
      }
    },
    onDragStart: () => emit('dragStart', props.node),
    onDrop: () => emit('dragEnd', props.node),
    onGenerateDragPreview: props.node.renderDragPreview
      ? ({ nativeSetDragImage }) => {
          setCustomNativeDragPreview({
            render: ({ container }) => {
              return props.node.renderDragPreview?.(container)
            },
            nativeSetDragImage
          })
        }
      : undefined
  })
}

if (props.node.droppable) {
  usePragmaticDroppable(treeNodeElementGetter, {
    onDrop: async (event) => {
      const dndData = event.source.data as TreeExplorerDragAndDropData
      if (dndData.type === 'tree-explorer-node') {
        await props.node.handleDrop?.(dndData as TreeExplorerDragAndDropData<T>)
        canDrop.value = false
        emit(
          'itemDropped',
          props.node,
          dndData.data as RenderedTreeExplorerNode<T>
        )
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
