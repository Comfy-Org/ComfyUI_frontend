<template>
  <div ref="container" class="model-lib-node-container h-full w-full">
    <TreeExplorerTreeNode :node="node"> </TreeExplorerTreeNode>

    <teleport v-if="isHovered" to="#model-library-model-preview-container">
      <div class="model-lib-model-preview" :style="modelPreviewStyle">
        <ModelPreview ref="previewRef" :modelDef="modelDef"></ModelPreview>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import ModelPreview from './ModelPreview.vue'
import { ComfyModelDef } from '@/stores/modelStore'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'
import {
  computed,
  CSSProperties,
  nextTick,
  onMounted,
  onUnmounted,
  ref
} from 'vue'
import { useSettingStore } from '@/stores/settingStore'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyModelDef>
}>()

const modelDef = computed(() => props.node.data)

const previewRef = ref<InstanceType<typeof ModelPreview> | null>(null)
const modelPreviewStyle = ref<CSSProperties>({
  position: 'absolute',
  top: '0px',
  left: '0px'
})

const settingStore = useSettingStore()
const sidebarLocation = computed<'left' | 'right'>(() =>
  settingStore.get('Comfy.Sidebar.Location')
)

const handleModelHover = async () => {
  const hoverTarget = modelContentElement.value
  const targetRect = hoverTarget.getBoundingClientRect()

  const previewHeight = previewRef.value?.$el.offsetHeight || 0
  const availableSpaceBelow = window.innerHeight - targetRect.bottom

  modelPreviewStyle.value.top =
    previewHeight > availableSpaceBelow
      ? `${Math.max(0, targetRect.top - (previewHeight - availableSpaceBelow) - 20)}px`
      : `${targetRect.top - 40}px`
  if (sidebarLocation.value === 'left') {
    modelPreviewStyle.value.left = `${targetRect.right}px`
  } else {
    modelPreviewStyle.value.left = `${targetRect.left - 400}px`
  }

  modelDef.value.load()
}

const container = ref<HTMLElement | null>(null)
const modelContentElement = ref<HTMLElement | null>(null)
const isHovered = ref(false)
const handleMouseEnter = async () => {
  isHovered.value = true
  await nextTick()
  handleModelHover()
}
const handleMouseLeave = () => {
  isHovered.value = false
}
onMounted(() => {
  modelContentElement.value = container.value?.closest('.p-tree-node-content')
  modelContentElement.value?.addEventListener('mouseenter', handleMouseEnter)
  modelContentElement.value?.addEventListener('mouseleave', handleMouseLeave)
})

onUnmounted(() => {
  modelContentElement.value?.removeEventListener('mouseenter', handleMouseEnter)
  modelContentElement.value?.removeEventListener('mouseleave', handleMouseLeave)
})
</script>
