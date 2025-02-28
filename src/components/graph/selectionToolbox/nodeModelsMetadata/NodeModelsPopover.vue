<template>
  <template v-if="node">
    <div ref="contentRef" class="flex flex-col overflow-y-auto px-4 py-2">
      <div class="mb-2 flex items-center justify-between">
        <span>{{ $t('nodeMetadata.models.title') }}</span>
      </div>
      <div class="flex flex-col gap-2">
        <template
          v-for="(model, index) of nodeModels"
          :key="`${model.name}${model.url || model.hash}`"
        >
          <ModelForm
            :model="model"
            :index="index"
            :node-id="node.id"
            :is-last="isLastModel(index)"
            @remove="removeModel(index)"
            @add="addEmptyModel"
          />
        </template>
        <div v-if="nodeModels.length === 0" class="flex items-center">
          <div class="flex-1 flex justify-center">
            <Button
              v-tooltip="$t('nodeMetadata.models.add')"
              icon="pi pi-plus"
              text
              size="small"
              @click="addEmptyModel"
            />
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { LGraphNode } from '@comfyorg/litegraph'
import { useResizeObserver } from '@vueuse/core'
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'

import ModelForm from '@/components/graph/selectionToolbox/nodeModelsMetadata/ModelForm.vue'
import type { ModelFile } from '@/schemas/comfyWorkflowSchema'
import { useCanvasStore } from '@/stores/graphStore'
import { isModelNode } from '@/utils/litegraphUtil'

const canvasStore = useCanvasStore()

const contentRef = ref<HTMLElement>()
const nodeModels = ref<ModelFile[]>([])
const node = ref<LGraphNode | null>(null)

const isLastModel = (index: number) => index === nodeModels.value.length - 1
const formatMaxHeight = (top: number) => `calc(100vh - ${top}px)`

const addEmptyModel = () => {
  nodeModels.value.push({ name: '', url: '', directory: '' })
}
const removeModel = (index: number) => {
  nodeModels.value.splice(index, 1)
  const models = node.value?.properties?.models as ModelFile[]
  if (models) models.splice(index, 1)
}

useResizeObserver(contentRef, () => {
  if (contentRef.value) {
    contentRef.value.style.maxHeight = formatMaxHeight(
      contentRef.value.getBoundingClientRect().top
    )
  }
})

onMounted(() => {
  const nodes = canvasStore.selectedItems.filter(isModelNode)
  node.value = nodes[0]

  if (node.value?.properties?.models) {
    nodeModels.value = [...(node.value.properties.models as ModelFile[])]
  }
})
</script>
