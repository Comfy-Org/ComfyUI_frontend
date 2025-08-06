<template>
  <div class="relative w-full p-4">
    <div class="h-12 flex items-center gap-4 justify-between">
      <div class="flex-1 max-w-md">
        <div class="relative w-full">
          <div
            class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10"
          >
            <i class="pi pi-search text-surface-400"></i>
          </div>
          <AutoComplete
            v-model.lazy="searchQuery"
            :placeholder="$t('templateWorkflows.searchPlaceholder')"
            :complete-on-focus="false"
            :delay="200"
            class="w-full"
            :pt="{
              pcInputText: {
                root: {
                  class: 'w-full rounded-md pl-10 pr-10'
                }
              },
              loader: {
                style: 'display: none'
              }
            }"
            :show-empty-message="false"
            @complete="() => {}"
          />
          <div
            v-if="searchQuery"
            class="absolute inset-y-0 right-0 flex items-center pr-3 z-10"
          >
            <button
              type="button"
              class="text-surface-400 hover:text-surface-600 bg-transparent border-none p-0 cursor-pointer"
              @click="searchQuery = ''"
            >
              <i class="pi pi-times"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Model Filter Dropdown -->
        <div class="relative">
          <Button
            ref="modelFilterButton"
            :label="modelFilterLabel"
            icon="pi pi-filter"
            outlined
            class="rounded-2xl"
            @click="toggleModelFilter"
          />
          <Popover
            ref="modelFilterPopover"
            :pt="{
              root: { class: 'w-64 max-h-80 overflow-auto' }
            }"
          >
            <div class="p-3">
              <div class="font-medium mb-2">
                {{ $t('templateWorkflows.modelFilter') }}
              </div>
              <div class="flex flex-col gap-2">
                <div
                  v-for="model in availableModels"
                  :key="model"
                  class="flex items-center"
                >
                  <Checkbox
                    :model-value="selectedModels.includes(model)"
                    :binary="true"
                    @change="toggleModel(model)"
                  />
                  <label class="ml-2 text-sm">{{ model }}</label>
                </div>
              </div>
            </div>
          </Popover>
        </div>

        <!-- Sort Dropdown -->
        <Select
          v-model="sortBy"
          :options="sortOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('templateWorkflows.sort')"
          class="rounded-2xl"
          :pt="{
            root: { class: 'min-w-32' }
          }"
        />
      </div>
    </div>

    <!-- Filter Tags Row -->
    <div
      v-if="selectedModels.length > 0"
      class="flex items-center gap-2 mt-3 overflow-x-auto pb-2"
    >
      <div class="flex gap-2">
        <Tag
          v-for="model in selectedModels"
          :key="model"
          :value="model"
          severity="secondary"
        >
          <template #icon>
            <button
              type="button"
              class="text-surface-400 hover:text-surface-600 bg-transparent border-none p-0 cursor-pointer ml-1"
              @click="removeModel(model)"
            >
              <i class="pi pi-times text-xs"></i>
            </button>
          </template>
        </Tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SortOption } from '@/composables/useTemplateFiltering'

const { t } = useI18n()

const { availableModels } = defineProps<{
  filteredCount?: number | null
  availableModels: string[]
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })
const selectedModels = defineModel<string[]>('selectedModels', {
  default: () => []
})
const sortBy = defineModel<SortOption>('sortBy', { default: 'recommended' })

// emit removed - no longer needed since clearFilters was removed

const modelFilterButton = ref<HTMLElement>()
const modelFilterPopover = ref()

const sortOptions = [
  { label: t('templateWorkflows.sortRecommended'), value: 'recommended' },
  { label: t('templateWorkflows.sortAlphabetical'), value: 'alphabetical' },
  { label: t('templateWorkflows.sortNewest'), value: 'newest' }
]

const modelFilterLabel = computed(() => {
  if (selectedModels.value.length === 0) {
    return t('templateWorkflows.modelFilter')
  } else if (selectedModels.value.length === 1) {
    return selectedModels.value[0]
  } else {
    return t('templateWorkflows.modelsSelected', {
      count: selectedModels.value.length
    })
  }
})

const toggleModelFilter = (event: Event) => {
  modelFilterPopover.value.toggle(event)
}

const toggleModel = (model: string) => {
  const index = selectedModels.value.indexOf(model)
  if (index > -1) {
    selectedModels.value.splice(index, 1)
  } else {
    selectedModels.value.push(model)
  }
}

const removeModel = (model: string) => {
  const index = selectedModels.value.indexOf(model)
  if (index > -1) {
    selectedModels.value.splice(index, 1)
  }
}

// clearFilters function removed - no longer used since we removed the clear button
</script>
