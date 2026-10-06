<template>
  <div ref="container" class="model-lib-node-container size-full">
    <TreeExplorerTreeNode :node />

    <teleport v-if="showPreview" to="#model-library-model-preview-container">
      <div class="model-lib-model-preview" :style="modelPreviewStyle">
        <ModelPreview ref="previewRef" :model-def="modelDef" />
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onMounted, ref } from 'vue'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyModelDef } from '@/stores/modelStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import ModelPreview from './ModelPreview.vue'

const { node } = defineProps<{
  node: RenderedTreeExplorerNode<ComfyModelDef>
}>()

// Note: The leaf node should always have a model definition on node.data.
const modelDef = computed<ComfyModelDef>(() => node.data!)

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

const positionPreview = (row: HTMLElement) => {
  const targetRect = row.getBoundingClientRect()

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
}

const container = ref<HTMLElement | undefined>()
const row = computed(() =>
  container.value?.closest<HTMLElement>('.tree-explorer-item')
)
const isHovered = ref(false)
useEventListener(row, 'mouseenter', async () => {
  isHovered.value = true
  await nextTick()
  if (row.value) positionPreview(row.value)
  await modelDef.value.load()
})
useEventListener(row, 'mouseleave', () => {
  isHovered.value = false
})

const showPreview = computed(() => {
  return (
    isHovered.value &&
    modelDef.value &&
    modelDef.value.has_loaded_metadata &&
    (modelDef.value.author ||
      modelDef.value.simplified_file_name != modelDef.value.title ||
      modelDef.value.description ||
      modelDef.value.usage_hint ||
      modelDef.value.trigger_phrase ||
      modelDef.value.image)
  )
})

onMounted(async () => {
  await modelDef.value.load()
})
</script>
