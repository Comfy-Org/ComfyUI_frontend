<template>
  <div ref="container" class="model-lib-node-container size-full">
    <TreeExplorerTreeNode :node />
    <div
      v-if="showPreview"
      ref="preview"
      class="model-lib-model-preview pointer-events-none fixed z-1001"
      :style="previewStyle"
    >
      <ModelPreview :model-def="modelDef" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  useElementBounding,
  useElementHover,
  useElementSize,
  useWindowSize
} from '@vueuse/core'
import { computed, onMounted, useTemplateRef } from 'vue'

import TreeExplorerTreeNode from '@/components/common/TreeExplorerTreeNode.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyModelDef } from '@/stores/modelStore'
import type { RenderedTreeExplorerNode } from '@/types/treeExplorerTypes'

import ModelPreview from './ModelPreview.vue'

const PREVIEW_WIDTH = 400
const PREVIEW_TOP_OFFSET = 40
const PREVIEW_BOTTOM_GAP = 20

const { node } = defineProps<{
  node: RenderedTreeExplorerNode<ComfyModelDef>
}>()

const modelDef = computed<ComfyModelDef>(() => node.data!)

const container = useTemplateRef('container')
const isHovered = useElementHover(container)
const row = useElementBounding(container)
const { height: previewHeight } = useElementSize(useTemplateRef('preview'))
const { height: windowHeight } = useWindowSize()

const settingStore = useSettingStore()

const showPreview = computed(() => {
  const model = modelDef.value
  return (
    isHovered.value &&
    model.has_loaded_metadata &&
    Boolean(
      model.author ||
      model.simplified_file_name != model.title ||
      model.description ||
      model.usage_hint ||
      model.trigger_phrase ||
      model.image
    )
  )
})

const previewStyle = computed(() => {
  const spaceBelow = windowHeight.value - row.bottom.value
  const top =
    previewHeight.value > spaceBelow
      ? Math.max(
          0,
          row.top.value -
            (previewHeight.value - spaceBelow) -
            PREVIEW_BOTTOM_GAP
        )
      : row.top.value - PREVIEW_TOP_OFFSET
  const left =
    settingStore.get('Comfy.Sidebar.Location') === 'left'
      ? row.right.value
      : row.left.value - PREVIEW_WIDTH
  return { top: `${top}px`, left: `${left}px` }
})

onMounted(async () => {
  await modelDef.value.load()
})
</script>
