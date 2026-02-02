<template>
  <TreeItem
    v-slot="{ isExpanded, isSelected, handleToggle, handleSelect }"
    :value="item.value"
    :level="item.level"
    as-child
  >
    <ContextMenuTrigger
      v-if="showContextMenu && item.value.type === 'node'"
      as-child
    >
      <div
        class="group/tree-node flex w-full cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-highlight"
        :class="{ 'bg-highlight': isSelected }"
        :style="{ paddingLeft: `${16 + (item.level - 1) * 24}px` }"
        @click.stop="handleClick($event, handleToggle, handleSelect)"
        @contextmenu="handleContextMenu"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <i
          class="icon-[comfy--node] size-4 shrink-0 text-muted-foreground"
        />
        <span class="min-w-0 flex-1 truncate text-sm text-foreground">
          <slot name="node" :node="item.value">
            {{ item.value.label }}
          </slot>
        </span>
      </div>
    </ContextMenuTrigger>

    <!-- Node without context menu -->
    <div
      v-else-if="item.value.type === 'node'"
      class="group/tree-node flex w-full cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-highlight"
      :class="{ 'bg-highlight': isSelected }"
      :style="{ paddingLeft: `${16 + (item.level - 1) * 24}px` }"
      @click.stop="handleClick($event, handleToggle, handleSelect)"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <i class="icon-[comfy--node] size-4 shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1 truncate text-sm text-foreground">
        <slot name="node" :node="item.value">
          {{ item.value.label }}
        </slot>
      </span>
    </div>

    <!-- Folder -->
    <div
      v-else
      class="group/tree-node flex w-full cursor-pointer select-none items-center gap-3 overflow-hidden py-2 outline-none hover:bg-highlight"
      :class="{ 'bg-highlight': isSelected }"
      :style="{ paddingLeft: `${16 + (item.level - 1) * 24}px` }"
      @click.stop="handleClick($event, handleToggle, handleSelect)"
    >
      <i
        class="icon-[ph--folder-fill] size-4 shrink-0 text-muted-foreground"
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
    v-if="isHovered && item.value.type === 'node' && item.value.data"
    to="#node-library-node-preview-container-v2"
  >
    <div :style="nodePreviewStyle">
      <NodePreview :node-def="item.value.data" />
    </div>
  </Teleport>
</template>

<script lang="ts">
import type { InjectionKey, Ref } from 'vue'

import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

export const contextMenuNodeKey: InjectionKey<
  Ref<RenderedTreeExplorerNode | null>
> = Symbol('contextMenuNode')
</script>

<script setup lang="ts">
import type { FlattenedItem } from 'reka-ui'
import { ContextMenuTrigger, TreeItem } from 'reka-ui'
import type { CSSProperties } from 'vue'
import { computed, inject, ref } from 'vue'

import NodePreview from '@/components/node/NodePreview.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@/utils/tailwindUtil'

const { item, showContextMenu = false } = defineProps<{
  item: FlattenedItem<RenderedTreeExplorerNode>
  showContextMenu?: boolean
}>()

const emit = defineEmits<{
  nodeClick: [node: RenderedTreeExplorerNode, event: MouseEvent]
}>()

const contextMenuNode = inject(contextMenuNodeKey)
const settingStore = useSettingStore()

const isHovered = ref(false)
const nodePreviewStyle = ref<CSSProperties>({
  position: 'fixed',
  top: '0px',
  left: '0px',
  pointerEvents: 'none',
  zIndex: 1001
})

const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

function handleClick(
  e: MouseEvent,
  _handleToggle: () => void,
  handleSelect: () => void
) {
  handleSelect()
  emit('nodeClick', item.value, e)
}

function handleContextMenu() {
  if (contextMenuNode) {
    contextMenuNode.value = item.value
  }
}

function handleMouseEnter(e: MouseEvent) {
  if (item.value.type !== 'node') return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const margin = 40

  nodePreviewStyle.value = {
    position: 'fixed',
    top: `${rect.top}px`,
    left:
      sidebarLocation.value === 'left'
        ? `${rect.right + margin}px`
        : `${rect.left - margin}px`,
    transform: sidebarLocation.value === 'right' ? 'translateX(-100%)' : undefined,
    pointerEvents: 'none',
    zIndex: 1001
  }
  isHovered.value = true
}

function handleMouseLeave() {
  isHovered.value = false
}
</script>
