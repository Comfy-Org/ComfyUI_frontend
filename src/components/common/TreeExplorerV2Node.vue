<template>
  <TreeItem
    v-slot="{ isExpanded, isSelected, handleToggle, handleSelect }"
    :value="item.value"
    :level="item.level"
    as-child
  >
    <!-- Node -->
    <div
      v-if="item.value.type === 'node'"
      v-bind="$attrs"
      :class="cn(ROW_CLASS, isSelected && 'bg-comfy-input')"
      :style="rowStyle"
      draggable="true"
      @click.stop="handleClick($event, handleToggle, handleSelect)"
      @contextmenu="handleContextMenu"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
    >
      <i class="icon-[comfy--node] size-4 shrink-0 text-muted-foreground" />
      <span
        class="text-foreground min-w-0 flex-1 truncate text-sm [&_.highlight]:rounded-sm [&_.highlight]:bg-primary-background [&_.highlight]:px-0.5 [&_.highlight]:font-bold [&_.highlight]:text-white"
      >
        <slot name="node" :node="item.value">
          <span v-if="highlightedLabel" v-html="highlightedLabel" />
          <template v-else>{{ item.value.label }}</template>
        </slot>
      </span>
      <button
        :class="
          cn(
            'hover:text-foreground flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-muted-foreground',
            'opacity-0 group-hover/tree-node:opacity-100'
          )
        "
        :aria-label="$t('icon.bookmark')"
        @click.stop="toggleBookmark"
      >
        <i
          :class="
            cn(
              isBookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark',
              'text-xs'
            )
          "
        />
      </button>
    </div>

    <!-- Folder -->
    <div
      v-else
      v-bind="$attrs"
      :class="cn(ROW_CLASS, isSelected && 'bg-comfy-input')"
      :style="rowStyle"
      @click.stop="handleClick($event, handleToggle, handleSelect)"
    >
      <i
        v-if="item.hasChildren"
        :class="
          cn(
            'icon-[lucide--chevron-down] size-4 shrink-0 text-muted-foreground transition-transform',
            !isExpanded && '-rotate-90'
          )
        "
      />
      <i
        :class="cn(item.value.icon, 'size-4 shrink-0 text-muted-foreground')"
      />
      <span class="text-foreground min-w-0 flex-1 truncate text-sm">
        <slot name="folder" :node="item.value">
          {{ item.value.label }}
        </slot>
      </span>
    </div>
  </TreeItem>

  <Teleport
    v-if="showPreview && item.value.type === 'node' && item.value.data"
    to="body"
  >
    <div
      :ref="(el) => (previewRef = el as HTMLElement)"
      :style="nodePreviewStyle"
    >
      <NodePreviewCard :node-def="item.value.data as ComfyNodeDefImpl" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { FlattenedItem } from 'reka-ui'
import { TreeItem } from 'reka-ui'
import { computed, inject, ref } from 'vue'

import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { useNodePreviewAndDrag } from '@/composables/node/useNodePreviewAndDrag'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import {
  InjectKeyContextMenuNode,
  InjectKeySearchHighlights
} from '@/types/treeExplorerTypes'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

defineOptions({
  inheritAttrs: false
})

const ROW_CLASS =
  'group/tree-node flex w-full min-w-0 cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-comfy-input mx-2 rounded'

const { item } = defineProps<{
  item: FlattenedItem<RenderedTreeExplorerNode<ComfyNodeDefImpl>>
}>()

const emit = defineEmits<{
  nodeClick: [
    node: RenderedTreeExplorerNode<ComfyNodeDefImpl>,
    event: MouseEvent
  ]
}>()

const contextMenuNode = inject(InjectKeyContextMenuNode)
const searchHighlights = inject(
  InjectKeySearchHighlights,
  ref(new Map<string, string>())
)
const nodeBookmarkStore = useNodeBookmarkStore()

const nodeDef = computed(() => item.value.data)
const highlightedLabel = computed(() => {
  const name = nodeDef.value?.name
  if (!name) return ''
  return searchHighlights.value.get(name) ?? ''
})

const isBookmarked = computed(() => {
  if (!nodeDef.value) return false
  return nodeBookmarkStore.isBookmarked(nodeDef.value)
})

function toggleBookmark() {
  if (nodeDef.value) {
    nodeBookmarkStore.toggleBookmark(nodeDef.value)
  }
}

const {
  previewRef,
  showPreview,
  nodePreviewStyle,
  handleMouseEnter: baseHandleMouseEnter,
  handleMouseLeave,
  handleDragStart: baseHandleDragStart,
  handleDragEnd
} = useNodePreviewAndDrag(nodeDef)

const rowStyle = computed(() => ({
  paddingLeft: `${8 + (item.level - 1) * 24}px`
}))

function handleClick(
  e: MouseEvent,
  handleToggle: () => void,
  handleSelect: () => void
) {
  handleSelect()
  if (item.value.type === 'folder') {
    handleToggle()
  }
  emit('nodeClick', item.value, e)
}

function handleContextMenu() {
  if (contextMenuNode) {
    contextMenuNode.value = item.value
  }
}

function handleMouseEnter(e: MouseEvent) {
  if (item.value.type !== 'node') return
  baseHandleMouseEnter(e)
}

function handleDragStart(e: DragEvent) {
  if (item.value.type !== 'node' || !item.value.data) return
  baseHandleDragStart(e)
}
</script>
