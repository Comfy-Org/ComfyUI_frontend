<template>
  <BaseModalLayout
    :content-title="$t('modelBrowser.title')"
    @close="handleClose"
  >
    <template #leftPanelHeaderTitle>
      <i class="icon-[comfy--ai-model] size-4" />
      <h2 class="flex-auto select-none text-base font-semibold text-nowrap">
        {{ $t('modelBrowser.title') }}
      </h2>
    </template>

    <template #leftPanel>
      <LeftSidePanel
        v-model="selectedNavItem"
        data-component-id="ModelBrowserDialog-LeftSidePanel"
        :nav-items="navItems"
      />
    </template>

    <template #header>
      <SearchBox
        v-model="searchQuery"
        :autofocus="true"
        size="lg"
        :placeholder="$t('modelBrowser.searchPlaceholder')"
        class="max-w-96"
      />
    </template>

    <template #content>
      <ModelBrowserStates
        :is-loading="isLoading"
        :error="error"
        :is-empty="filteredModels.length === 0"
        :empty-message="
          searchQuery
            ? $t('modelBrowser.noModelsForFilter')
            : $t('modelBrowser.noModels')
        "
        :show-clear-filters="!!searchQuery"
        @retry="retryLoad"
        @clear-filters="clearFilters"
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
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import SearchBox from '@/components/common/SearchBox.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import LeftSidePanel from '@/components/widget/panel/LeftSidePanel.vue'
import { useModelBrowserFiltering } from '@/composables/useModelBrowserFiltering'
import { useModelLoader } from '@/composables/useModelLoader'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { ComfyModelDef } from '@/stores/modelStore'
import type { EnrichedModel } from '@/types/modelBrowserTypes'
import type { NavGroupData } from '@/types/navTypes'

import ModelBrowserStates from './ModelBrowserStates.vue'
import ModelCard from './ModelCard.vue'

const { t } = useI18n()

const emit = defineEmits<{
  select: [model: ComfyModelDef]
  close: []
}>()

const { isLoading, error, models, loadModels, retryLoad } = useModelLoader()

const focusedModel = ref<EnrichedModel | null>(null)
const selectedNavItem = ref<string>('all')

const { modelTypes, fetchModelTypes } = useModelTypes()

const { searchQuery, selectedModelType, filteredModels, clearFilters } =
  useModelBrowserFiltering(models, {
    searchDebounce: 300
  })

const navItems = computed<NavGroupData[]>(() => {
  const typeItems =
    modelTypes.value?.map((type) => ({
      id: type.value,
      label: type.name,
      icon: 'icon-[lucide--folder]'
    })) || []

  return [
    {
      title: '',
      collapsible: false,
      items: [
        {
          id: 'all',
          label: t('modelBrowser.allModels'),
          icon: 'icon-[comfy--ai-model]'
        }
      ]
    },
    {
      title: t('modelBrowser.filterByType'),
      collapsible: false,
      items: typeItems
    }
  ]
})

watch(selectedNavItem, (newValue) => {
  if (newValue === 'all') {
    selectedModelType.value = null
  } else {
    selectedModelType.value = newValue
  }
})

onMounted(() => {
  loadModels()
  fetchModelTypes()
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
