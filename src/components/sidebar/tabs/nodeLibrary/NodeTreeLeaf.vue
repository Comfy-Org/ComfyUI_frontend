<template>
  <div ref="container" class="node-lib-node-container">
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
      <template
        v-if="nodeDef.name.startsWith(useSubgraphStore().typePrefix)"
        #actions
      >
        <Button
          size="small"
          icon="pi pi-trash"
          text
          severity="danger"
          @click.stop="deleteBlueprint"
        >
        </Button>
        <Button
          size="small"
          text
          severity="secondary"
          @click.stop="editBlueprint"
        >
          <template #icon>
            <i class="icon-[lucide--square-pen]" />
          </template>
        </Button>
      </template>
      <template v-else #actions>
        <Button
          class="bookmark-button"
          size="small"
          :icon="isBookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
          text
          severity="secondary"
          @click.stop="toggleBookmark"
        />
        <Button
          v-tooltip.bottom="$t('g.learnMore')"
          class="help-button"
          size="small"
          icon="pi pi-question"
          text
          severity="secondary"
          @click.stop="props.openNodeHelp(nodeDef)"
        />
      </template>
    </TreeExplorerTreeNode>

    <teleport v-if="isHovered" to="#node-library-node-preview-container">
      <div class="node-lib-node-preview" :style="nodePreviewStyle">
        <NodePreview ref="previewRef" :node-def="nodeDef" />
      </div>
    </teleport>
  </div>
  <ContextMenu ref="menu" :model="menuItems" />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import Tag from 'primevue/tag'
import type { CSSProperties } from 'vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

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
const editBlueprint = async () => {
  if (!props.node.data)
    throw new Error(
      'Failed to edit subgraph blueprint lacking backing node data'
    )
  await useSubgraphStore().editBlueprint(props.node.data.name)
}
const menu = ref<InstanceType<typeof ContextMenu> | null>(null)
const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [
    {
      label: t('g.delete'),
      icon: 'pi pi-trash',
      severity: 'error',
      command: deleteBlueprint
    }
  ]
  return items
})
function handleContextMenu(event: Event) {
  if (!nodeDef.value.name.startsWith(useSubgraphStore().typePrefix)) return
  menu.value?.show(event)
}
function deleteBlueprint() {
  if (!props.node.data) return
  void useSubgraphStore().deleteBlueprint(props.node.data.name)
}

const previewRef = ref<InstanceType<typeof NodePreview> | null>(null)
const nodePreviewStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0px',
  left: '0px'
})

const handleNodeHover = async () => {
  const hoverTarget = nodeContentElement.value
  if (!hoverTarget) return

  const targetRect = hoverTarget.getBoundingClientRect()

  const previewHeight = previewRef.value?.$el.offsetHeight || 0
  const availableSpaceBelow = window.innerHeight - targetRect.bottom

  nodePreviewStyle.value.top =
    previewHeight > availableSpaceBelow
      ? `${Math.max(0, targetRect.top - (previewHeight - availableSpaceBelow) - 20)}px`
      : `${targetRect.top - 40}px`
  if (sidebarLocation.value === 'left') {
    nodePreviewStyle.value.left = `${targetRect.right}px`
  } else {
    nodePreviewStyle.value.left = `${targetRect.left - 400}px`
  }
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

<style scoped>
@reference '../../../../assets/css/style.css';

.node-lib-node-container {
  @apply h-full w-full;
}
</style>
