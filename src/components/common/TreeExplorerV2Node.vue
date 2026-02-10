<template>
  <TreeItem
    v-slot="{ isExpanded, isSelected, handleToggle, handleSelect }"
    :value="item.value"
    :level="item.level"
    as-child
  >
    <!-- Node with context menu -->
    <ContextMenuTrigger v-if="item.value.type === 'node'" as-child>
      <div
        :class="cn(ROW_CLASS, isSelected && 'bg-highlight')"
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
        <span class="min-w-0 flex-1 truncate text-sm text-foreground">
          <slot name="node" :node="item.value">
            {{ item.value.label }}
          </slot>
        </span>
      </div>
    </ContextMenuTrigger>

    <!-- Folder -->
    <div
      v-else
      :class="cn(ROW_CLASS, isSelected && 'bg-highlight')"
      :style="rowStyle"
      @click.stop="handleClick($event, handleToggle, handleSelect)"
    >
      <i
        :class="cn(item.value.icon, 'size-4 shrink-0 text-muted-foreground')"
      />
      <span class="min-w-0 flex-1 truncate text-sm text-foreground">
        <slot name="folder" :node="item.value">
          {{ item.value.label }}
        </slot>
      </span>
      <i
        v-if="item.hasChildren"
        :class="
          cn(
            'icon-[lucide--chevron-down] mr-4 size-4 shrink-0 text-muted-foreground transition-transform',
            !isExpanded && '-rotate-90'
          )
        "
      />
    </div>
  </TreeItem>

  <Teleport
    v-if="showPreview && item.value.type === 'node' && item.value.data"
    to="#node-library-node-preview-container-v2"
  >
    <div ref="previewRef" :style="nodePreviewStyle">
      <NodePreviewCard :node-def="item.value.data" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { FlattenedItem } from 'reka-ui'
import { ContextMenuTrigger, TreeItem } from 'reka-ui'
import type { CSSProperties } from 'vue'
import { computed, inject, ref } from 'vue'

import NodePreviewCard from '@/components/node/NodePreviewCard.vue'
import { useNodeDragToCanvas } from '@/composables/node/useNodeDragToCanvas'
import { useSettingStore } from '@/platform/settings/settingStore'
import { InjectKeyContextMenuNode } from '@/types/treeExplorerTypes'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@/utils/tailwindUtil'

const ROW_CLASS =
  'group/tree-node flex w-full cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-highlight'

const { item } = defineProps<{
  item: FlattenedItem<RenderedTreeExplorerNode>
}>()

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode, event: MouseEvent]
}>()

const contextMenuNode = inject(InjectKeyContextMenuNode)
const settingStore = useSettingStore()
const { startDrag, handleNativeDrop, cancelDrag } = useNodeDragToCanvas()

const isHovered = ref(false)
const isDraggingNode = ref(false)
const previewRef = ref<HTMLElement>()
const nodePreviewStyle = ref<CSSProperties>({
  position: 'fixed',
  top: '0px',
  left: '0px',
  pointerEvents: 'none',
  zIndex: 1001
})

const showPreview = computed(() => isHovered.value && !isDraggingNode.value)

const rowStyle = computed(() => ({
  paddingLeft: `${16 + (item.level - 1) * 24}px`
}))

const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

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

const PREVIEW_WIDTH = 176
const PREVIEW_MARGIN = 16

function handleMouseEnter(e: MouseEvent) {
  if (item.value.type !== 'node') return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let left: number
  if (sidebarLocation.value === 'left') {
    left = rect.right + PREVIEW_MARGIN
    if (left + PREVIEW_WIDTH > viewportWidth) {
      left = rect.left - PREVIEW_MARGIN - PREVIEW_WIDTH
    }
  } else {
    left = rect.left - PREVIEW_MARGIN - PREVIEW_WIDTH
    if (left < 0) {
      left = rect.right + PREVIEW_MARGIN
    }
  }

  const mouseY = rect.top + rect.height / 2
  let top = rect.top

  nodePreviewStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    pointerEvents: 'none',
    zIndex: 1001
  }
  isHovered.value = true

  requestAnimationFrame(() => {
    if (previewRef.value) {
      const previewRect = previewRef.value.getBoundingClientRect()
      const previewHeight = previewRect.height

      top = mouseY - previewHeight * 0.3

      const minTop = PREVIEW_MARGIN
      const maxTop = viewportHeight - previewHeight - PREVIEW_MARGIN
      top = Math.max(minTop, Math.min(top, maxTop))

      nodePreviewStyle.value = {
        ...nodePreviewStyle.value,
        top: `${top}px`
      }
    }
  })
}

function handleMouseLeave() {
  isHovered.value = false
}

function handleDragStart(e: DragEvent) {
  if (item.value.type !== 'node' || !item.value.data) return

  isDraggingNode.value = true
  isHovered.value = false

  startDrag(item.value.data, 'native')

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-comfy-node', item.value.data.name)

    const dragImage = createDragImage()
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)

    requestAnimationFrame(() => {
      document.body.removeChild(dragImage)
    })
  }
}

function createDragImage(): HTMLElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  el.style.top = '-9999px'
  el.style.width = '1px'
  el.style.height = '1px'
  return el
}

function handleDragEnd(e: DragEvent) {
  isDraggingNode.value = false

  if (e.dataTransfer?.dropEffect !== 'none') {
    handleNativeDrop(e.clientX, e.clientY)
  } else {
    cancelDrag()
  }
}
</script>
