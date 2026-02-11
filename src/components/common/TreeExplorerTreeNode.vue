<template>
  <div
    ref="container"
    :class="[
      'tree-node',
      {
        'can-drop': canDrop,
        'tree-folder': !node.leaf,
        'tree-leaf': node.leaf
      }
    ]"
    :data-testid="`tree-node-${node.key}`"
  >
    <div class="node-content">
      <span class="node-label">
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
        :value="nodeBadgeText"
        severity="secondary"
        class="leaf-count-badge"
      />
    </div>
    <div
      class="node-actions flex gap-1 touch:opacity-100 motion-safe:opacity-0 motion-safe:group-hover/tree-node:opacity-100"
    >
      <slot name="actions" :node="node" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import Badge from 'primevue/badge'
import { computed, inject, ref } from 'vue'

import EditableText from '@/components/common/EditableText.vue'
import {
  usePragmaticDraggable,
  usePragmaticDroppable
} from '@/composables/usePragmaticDragAndDrop'
import { InjectKeyHandleEditLabelFunction } from '@/types/treeExplorerTypes'
import type {
  RenderedTreeExplorerNode,
  TreeExplorerDragAndDropData
} from '@/types/treeExplorerTypes'

const { node } = defineProps<{
  node: RenderedTreeExplorerNode
}>()

const emit = defineEmits<{
  (
    e: 'itemDropped',
    node: RenderedTreeExplorerNode,
    data: RenderedTreeExplorerNode
  ): void
  (e: 'dragStart', node: RenderedTreeExplorerNode): void
  (e: 'dragEnd', node: RenderedTreeExplorerNode): void
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
const handleRename = (newName: string) => {
  handleEditLabel?.(node, newName)
}

const container = ref<HTMLElement | null>(null)
const canDrop = ref(false)

const treeNodeElementGetter = () =>
  container.value?.closest('.p-tree-node-content') as HTMLElement

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
        await node.handleDrop?.(dndData)
        canDrop.value = false
        emit('itemDropped', node, dndData.data)
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

<style scoped>
.tree-node {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.leaf-count-badge {
  margin-left: 0.5rem;
}
.node-content {
  display: flex;
  align-items: center;
  flex-grow: 1;
}
.leaf-label {
  margin-left: 0.5rem;
}
:deep(.editable-text span) {
  word-break: break-all;
}
</style>
