<template>
  <div ref="container" class="node-lib-node-container">
    <TreeExplorerTreeNode :node="node">
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
      <template #actions>
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
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import {
  CSSProperties,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref
} from 'vue'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import NodePreview from '@/components/node/NodePreview.vue'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

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
.node-lib-node-container {
  @apply h-full w-full;
}
</style>
