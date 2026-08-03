<template>
  <ContextMenuRoot>
    <ContextMenuTrigger :disabled="!showContextMenu" as-child>
      <TreeRoot
        :expanded="[...expandedKeys]"
        :items="root.children ?? []"
        :get-key="(item) => item.key"
        :get-children="
          (item) => (item.children?.length ? item.children : undefined)
        "
        class="m-0 min-w-0 p-0 px-2 pb-2"
      >
        <TreeVirtualizer
          v-slot="{ item }"
          :estimate-size="36"
          :text-content="(item) => item.value.label ?? ''"
        >
          <TreeExplorerV2Node
            :item="
              item as FlattenedItem<RenderedTreeExplorerNode<ComfyNodeDefImpl>>
            "
            @node-click="
              (
                node: RenderedTreeExplorerNode<ComfyNodeDefImpl>,
                e: MouseEvent
              ) => emit('nodeClick', node, e)
            "
          >
            <template #folder="{ node }">
              <slot name="folder" :node="node" />
            </template>
            <template #node="{ node }">
              <slot name="node" :node="node" />
            </template>
          </TreeExplorerV2Node>
        </TreeVirtualizer>
      </TreeRoot>
    </ContextMenuTrigger>

    <ContextMenuPortal v-if="showContextMenu && contextMenuNode?.data">
      <ContextMenuContent
        class="z-9999 min-w-32 overflow-hidden rounded-md border border-border-default bg-comfy-menu-bg p-1 shadow-md"
      >
        <ContextMenuItem
          class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-highlight focus:bg-highlight"
          @select="handleToggleBookmark"
        >
          <i
            :class="
              isCurrentNodeBookmarked
                ? 'icon-[ph--star-fill]'
                : 'icon-[lucide--star]'
            "
            class="size-4"
          />
          {{
            isCurrentNodeBookmarked
              ? $t('sideToolbar.nodeLibraryTab.sections.unfavoriteNode')
              : $t('sideToolbar.nodeLibraryTab.sections.favoriteNode')
          }}
        </ContextMenuItem>
        <ContextMenuItem
          v-if="isCurrentNodeUserBlueprint"
          class="text-destructive flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-highlight focus:bg-highlight"
          @select="handleDeleteBlueprint"
        >
          <i class="icon-[lucide--trash-2] size-4" />
          {{ $t('g.delete') }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import type { FlattenedItem } from 'reka-ui'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  TreeRoot,
  TreeVirtualizer
} from 'reka-ui'
import { computed, provide, ref } from 'vue'

import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { InjectKeyContextMenuNode } from '@/types/treeExplorerTypes'

import TreeExplorerV2Node from './TreeExplorerV2Node.vue'

const { showContextMenu = false } = defineProps<{
  root: RenderedTreeExplorerNode<ComfyNodeDefImpl>
  showContextMenu?: boolean
}>()

const expandedKeys = defineModel<string[]>('expandedKeys', {
  default: () => []
})

const emit = defineEmits<{
  nodeClick: [
    node: RenderedTreeExplorerNode<ComfyNodeDefImpl>,
    event: MouseEvent
  ]
}>()

const contextMenuNode = ref<RenderedTreeExplorerNode<ComfyNodeDefImpl> | null>(
  null
)
provide(InjectKeyContextMenuNode, contextMenuNode)

const nodeBookmarkStore = useNodeBookmarkStore()
const subgraphStore = useSubgraphStore()

const isCurrentNodeBookmarked = computed(() => {
  const node = contextMenuNode.value
  if (!node?.data) return false
  return nodeBookmarkStore.isBookmarked(node.data)
})

const isCurrentNodeUserBlueprint = computed(() =>
  subgraphStore.isUserBlueprint(contextMenuNode.value?.data?.name)
)

function handleToggleBookmark() {
  const node = contextMenuNode.value
  if (node?.data) {
    nodeBookmarkStore.toggleBookmark(node.data)
  }
}

function handleDeleteBlueprint() {
  const name = contextMenuNode.value?.data?.name
  if (name) {
    void subgraphStore.deleteBlueprint(name)
  }
}
</script>
