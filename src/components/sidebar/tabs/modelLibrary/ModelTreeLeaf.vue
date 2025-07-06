<template>
  <div ref="container" class="model-lib-node-container h-full w-full">
    <TreeExplorerTreeNode :node="node">
      <template #before-label>
        <span v-if="modelPreviewUrl" class="model-lib-model-icon-container">
          <span
            class="model-lib-model-icon"
            :style="{ backgroundImage: `url(${modelPreviewUrl})` }"
          />
        </span>
      </template>
    </TreeExplorerTreeNode>

    <teleport v-if="showPreview" to="#model-library-model-preview-container">
      <div class="model-lib-model-preview" :style="modelPreviewStyle">
        <ModelPreview ref="previewRef" :model-def="modelDef" />
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { useModelPreview } from '@/composables/sidebarTabs/useModelPreview'
import { ComfyModelDef } from '@/stores/modelStore'
import { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import ModelPreview from './ModelPreview.vue'

const props = defineProps<{
  node: RenderedTreeExplorerNode<ComfyModelDef>
}>()

// Note: The leaf node should always have a model definition on node.data.
const modelDef = computed<ComfyModelDef>(() => props.node.data!)

const modelPreviewUrl = computed(() => {
  if (modelDef.value.image) {
    return modelDef.value.image
  }
  const folder = modelDef.value.directory
  const path_index = modelDef.value.path_index
  const extension = modelDef.value.file_name.split('.').pop()
  const filename = modelDef.value.file_name.replace(`.${extension}`, '.webp')
  const encodedFilename = encodeURIComponent(filename).replace(/%2F/g, '/')
  return `/api/experiment/models/preview/${folder}/${path_index}/${encodedFilename}`
})

// Use the preview composable
const {
  previewRef,
  modelPreviewStyle,
  shouldShowPreview,
  handleMouseEnter,
  handleMouseLeave
} = useModelPreview()

const container = ref<HTMLElement | undefined>()
const modelContentElement = ref<HTMLElement | undefined>()

const showPreview = computed(() => shouldShowPreview(modelDef.value))

const handleMouseEnterEvent = async () => {
  if (modelContentElement.value) {
    await handleMouseEnter(modelContentElement.value, modelDef.value)
  }
}

const handleMouseLeaveEvent = () => {
  handleMouseLeave()
}

onMounted(async () => {
  modelContentElement.value =
    container.value?.closest('.p-tree-node-content') ?? undefined
  modelContentElement.value?.addEventListener(
    'mouseenter',
    handleMouseEnterEvent
  )
  modelContentElement.value?.addEventListener(
    'mouseleave',
    handleMouseLeaveEvent
  )
  await modelDef.value.load()
})

onUnmounted(() => {
  modelContentElement.value?.removeEventListener(
    'mouseenter',
    handleMouseEnterEvent
  )
  modelContentElement.value?.removeEventListener(
    'mouseleave',
    handleMouseLeaveEvent
  )
})
</script>

<style scoped>
.model-lib-model-icon-container {
  display: inline-block;
  position: relative;
  left: 0;
  height: 1.5rem;
  vertical-align: top;
  width: 0;
}
.model-lib-model-icon {
  background-size: cover;
  background-position: center;
  display: inline-block;
  position: relative;
  left: -2.2rem;
  top: -0.1rem;
  height: 1.7rem;
  width: 1.7rem;
  vertical-align: top;
}
</style>
