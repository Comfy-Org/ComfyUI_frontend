<template>
  <BaseModalLayout
    :content-title="$t('modelBrowser.title')"
    @close="handleClose"
  >
    <template #content>
      <ModelBrowserStates
        :is-loading="isLoading"
        :error="error"
        :is-empty="filteredModels.length === 0"
        :empty-message="$t('modelBrowser.noModels')"
        :show-clear-filters="false"
        @retry="retryLoad"
      >
        <div class="flex-1 overflow-auto p-6">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <ModelCard
              v-for="model in filteredModels"
              :key="model.id"
              :model="model"
              :focused="focusedModel?.id === model.id"
              @focus="handleModelFocus"
              @select="handleModelSelect"
              @show-info="handleShowInfo"
            />
          </div>
        </div>
      </ModelBrowserStates>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import { useModelBrowserFiltering } from '@/composables/useModelBrowserFiltering'
import { useModelLoader } from '@/composables/useModelLoader'
import type { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/types/modelBrowserTypes'

import ModelBrowserStates from './ModelBrowserStates.vue'
import ModelCard from './ModelCard.vue'

const emit = defineEmits<{
  select: [model: ComfyModelDef]
  close: []
}>()

const { isLoading, error, models, loadModels, retryLoad } = useModelLoader()

const focusedModel = ref<EnrichedModel | null>(null)

const { filteredModels } = useModelBrowserFiltering(models, {
  searchDebounce: 300
})

onMounted(() => {
  loadModels()
})

function handleClose() {
  emit('close')
}

function handleModelFocus(model: EnrichedModel) {
  focusedModel.value = model
}

function handleModelSelect(model: EnrichedModel) {
  emit('select', model.original)
}

function handleShowInfo(model: EnrichedModel) {
  focusedModel.value = model
}
</script>
