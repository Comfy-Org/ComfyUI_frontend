<template>
  <div
    ref="container"
    class="node-lib-node-container size-full"
    data-testid="node-tree-leaf"
    :data-node-name="nodeDef.display_name"
  >
    <TreeExplorerTreeNode :node="node" @contextmenu="handleContextMenu">
      <template #before-label>
        <Tag
          v-if="nodeDef.experimental"
          :value="$t('g.experimental')"
          severity="primary"
        />
        <Tag
          v-if="nodeDef.deprecated"
          :value="$t('g.deprecated')"
          severity="danger"
        />
      </template>
      <template v-if="isUserBlueprint" #actions>
        <Button
          variant="destructive"
          size="icon-sm"
          :aria-label="$t('g.delete')"
          @click.stop="deleteBlueprint"
        >
          <i class="icon-[lucide--trash-2] size-4" />
        </Button>
        <Button
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="$t('g.edit')"
          @click.stop="editBlueprint"
        >
          <i class="icon-[lucide--square-pen] size-4" />
        </Button>
      </template>
      <template v-else #actions>
        <Button
          class="bookmark-button"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="$t('icon.bookmark')"
          @click.stop="toggleBookmark"
        >
          <i
            :class="
              cn(
                isBookmarked
                  ? 'icon-[lucide--bookmark] fill-current'
                  : 'icon-[lucide--bookmark]',
                'size-3.5'
              )
            "
          />
        </Button>
        <Button
          v-tooltip.bottom="$t('g.learnMore')"
          class="help-button"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="$t('g.learnMore')"
          @click.stop="onHelpClick"
        >
          <i class="icon-[lucide--circle-help] size-3.5" />
        </Button>
      </template>
    </TreeExplorerTreeNode>

    <teleport v-if="isHovered" to="#node-library-node-preview-container">
      <div class="node-lib-node-preview" :style="nodePreviewStyle">
        <NodePreview :node-def="nodeDef" />
      </div>
    </teleport>
  </div>
  <DropdownMenu v-model:open="menuOpen" :modal="false">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        aria-hidden="true"
        tabindex="-1"
        class="pointer-events-none fixed size-0 opacity-0"
        :style="{ left: `${menuAnchor.x}px`, top: `${menuAnchor.y}px` }"
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      size="lg"
      align="start"
      :side-offset="0"
      :collision-padding="8"
    >
      <DropdownMenuItem
        v-for="(menuItem, idx) in menuItems"
        :key="idx"
        :class="menuItemDestructiveClasses"
        @select="() => menuItem.command?.()"
      >
        <template v-if="menuItem.icon" #icon>
          <i :class="menuItem.icon" />
        </template>
        {{ menuItem.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import type { CSSProperties } from 'vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import Button from '@/components/ui/button/Button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import { menuItemDestructiveClasses } from '@/components/ui/menu.styles'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyNodeDefImpl>
  openNodeHelp: (nodeDef: ComfyNodeDefImpl) => void
}>()

// Note: node.data should be present for leaf nodes.
const nodeDef = computed(() => props.node.data!)
const nodeBookmarkStore = useNodeBookmarkStore()
const isBookmarked = computed(() =>
  nodeBookmarkStore.isBookmarked(nodeDef.value)
)
const settingStore = useSettingStore()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const toggleBookmark = async () => {
  await nodeBookmarkStore.toggleBookmark(nodeDef.value)
}

const onHelpClick = () => {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'node_library_help_button',
    element_group: 'node_library'
  })
  props.openNodeHelp(nodeDef.value)
}
const editBlueprint = async () => {
  if (!props.node.data)
    throw new Error(
      'Failed to edit subgraph blueprint lacking backing node data'
    )
  await useSubgraphStore().editBlueprint(props.node.data.name)
}
const menuOpen = ref(false)
const menuAnchor = ref({ x: 0, y: 0 })
const subgraphStore = useSubgraphStore()
const isUserBlueprint = computed(() => {
  const name = nodeDef.value.name
  if (!name.startsWith(subgraphStore.typePrefix)) return false
  return !subgraphStore.isGlobalBlueprint(
    name.slice(subgraphStore.typePrefix.length)
  )
})
type LeafMenuItem = {
  label: string
  icon?: string
  command?: () => void
}
const menuItems = computed<LeafMenuItem[]>(() => {
  if (!isUserBlueprint.value) return []

  return [
    {
      label: t('g.delete'),
      icon: 'icon-[lucide--trash-2]',
      command: deleteBlueprint
    }
  ]
})
function handleContextMenu(event: Event) {
  if (!isUserBlueprint.value) return
  const mouseEvent = event as MouseEvent
  event.preventDefault()
  menuAnchor.value = { x: mouseEvent.clientX, y: mouseEvent.clientY }
  menuOpen.value = true
}
function deleteBlueprint() {
  if (!props.node.data) return
  void subgraphStore.deleteBlueprint(props.node.data.name)
}

const nodePreviewStyle = ref<CSSProperties>({
  position: 'fixed',
  top: '0px',
  left: '0px',
  pointerEvents: 'none',
  zIndex: 1001
})

const handleNodeHover = async () => {
  const hoverTarget = nodeContentElement.value
  if (!hoverTarget) return

  const targetRect = hoverTarget.getBoundingClientRect()
  const margin = 40

  nodePreviewStyle.value.top = `${targetRect.top}px`
  nodePreviewStyle.value.left =
    sidebarLocation.value === 'left'
      ? `${targetRect.right + margin}px`
      : `${targetRect.left - margin}px`
  nodePreviewStyle.value.transform =
    sidebarLocation.value === 'right' ? 'translateX(-100%)' : undefined
}

const container = ref<HTMLElement | null>(null)
const nodeContentElement = ref<HTMLElement | null>(null)
const isHovered = ref(false)
const handleMouseEnter = async () => {
  isHovered.value = true
  await nextTick()
  await handleNodeHover()
}
const handleMouseLeave = () => {
  isHovered.value = false
}
onMounted(() => {
  nodeContentElement.value =
    container.value?.closest('.p-tree-node-content') ?? null
  nodeContentElement.value?.addEventListener('mouseenter', handleMouseEnter)
  nodeContentElement.value?.addEventListener('mouseleave', handleMouseLeave)
})

onUnmounted(() => {
  nodeContentElement.value?.removeEventListener('mouseenter', handleMouseEnter)
  nodeContentElement.value?.removeEventListener('mouseleave', handleMouseLeave)
})
</script>
