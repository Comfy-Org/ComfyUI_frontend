<template>
  <template v-if="selectedModelNode">
    <div ref="contentRef" class="flex flex-col overflow-y-auto px-4 py-2">
      <div class="mb-2">
        {{ $t('nodeMetadata.models.title') }}
      </div>
      <div class="flex flex-col gap-2">
        <template
          v-for="(model, index) of nodeModels"
          :key="`${model.name}${model.url || model.hash}`"
        >
          <ModelForm
            :model="model"
            :index="index"
            :is-first="index === 0"
            :is-last="isLastModel(index)"
            :show-save-button="shouldShowSaveButton(index)"
            @submit="submitModel(index, $event)"
            @remove="removeModel(index)"
            @add="nodeModels.push({ name: '', url: '', directory: '' })"
          />
        </template>
        <div v-if="nodeModels.length === 0" class="flex items-center">
          <div class="flex-1 flex justify-center">
            <Button
              v-tooltip="$t('nodeMetadata.models.add')"
              icon="pi pi-plus"
              text
              size="small"
              @click="nodeModels.push({ name: '', url: '', directory: '' })"
            />
          </div>
          <Button
            type="submit"
            icon="pi pi-check"
            severity="primary"
            size="small"
            v-tooltip="$t('nodeMetadata.models.save')"
            form="node-models-form"
          />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '@primevue/forms'
import { useResizeObserver } from '@vueuse/core'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelForm from '@/components/graph/selectionToolbox/nodeModelsMetadata/ModelForm.vue'
import type { ModelFile } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'
import { useCanvasStore } from '@/stores/graphStore'
import { isModelNode } from '@/utils/litegraphUtil'

const { t } = useI18n()
const toast = useToast()
const canvasStore = useCanvasStore()

const contentRef = ref<HTMLElement>()
const formatMaxHeight = (top: number) => `calc(100vh - ${top}px)`
useResizeObserver(contentRef, () => {
  if (contentRef.value) {
    contentRef.value.style.maxHeight = formatMaxHeight(
      contentRef.value.getBoundingClientRect().top
    )
  }
})

const selectedModelNode = computed(() => {
  const nodes = canvasStore.selectedItems.filter(isModelNode)
  if (!nodes.length) return null
  return app.graph.getNodeById(nodes[0].id)
})

const nodeModels = ref<ModelFile[]>([
  ...((selectedModelNode.value?.properties?.models as ModelFile[]) ?? [])
])

const isEmpty = computed(() => nodeModels.value.length === 0)
const isLastModel = (index: number) => index === nodeModels.value.length - 1
const shouldShowSaveButton = (index: number) =>
  isLastModel(index) || isEmpty.value

const updateNodeProperties = () => {
  if (!selectedModelNode.value) return
  if (!selectedModelNode.value.properties) {
    selectedModelNode.value.properties = {}
  }
  selectedModelNode.value.properties.models = nodeModels.value
}

const removeModel = (index: number) => {
  nodeModels.value.splice(index, 1)
  updateNodeProperties()
}

const submitModel = (index: number, event: FormSubmitEvent) => {
  if (event.valid) {
    try {
      nodeModels.value[index] = event.values
      updateNodeProperties()
      toast.add({
        severity: 'success',
        summary: t('nodeMetadata.models.modelUpdated'),
        life: 3000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('nodeMetadata.models.modelUpdateFailed'),
        detail: error instanceof Error ? error.message : String(error),
        life: 3000
      })
    }
  }
}
</script>
