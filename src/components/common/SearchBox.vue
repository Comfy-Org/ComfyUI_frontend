<template>
  <div>
    <IconField>
      <Button
        v-if="filterIcon"
        class="p-inputicon filter-button"
        :icon="filterIcon"
        text
        severity="contrast"
        @click="$emit('showFilter', $event)"
      />
      <InputText
        class="search-box-input w-full"
        :model-value="modelValue"
        :placeholder="placeholder"
        @input="handleInput"
      />
      <InputIcon v-if="!modelValue" :class="icon" />
      <Button
        v-if="modelValue"
        class="p-inputicon clear-button"
        icon="pi pi-times"
        text
        severity="contrast"
        @click="clearSearch"
      />
    </IconField>
    <div
      v-if="filters?.length"
      class="search-filters pt-2 flex flex-wrap gap-2"
    >
      <SearchFilterChip
        v-for="filter in filters"
        :key="filter.id"
        :text="filter.text"
        :badge="filter.badge"
        :badge-class="filter.badgeClass"
        @remove="$emit('removeFilter', filter)"
      />
    </div>
  </div>
</template>

<script setup lang="ts" generic="TFilter extends SearchFilter">
import { debounce } from 'lodash'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'

import type { SearchFilter } from './SearchFilterChip.vue'
import SearchFilterChip from './SearchFilterChip.vue'

const {
  modelValue,
  placeholder = 'Search...',
  icon = 'pi pi-search',
  debounceTime = 300,
  filterIcon,
  filters = []
} = defineProps<{
  modelValue: string
  placeholder?: string
  icon?: string
  debounceTime?: number
  filterIcon?: string
  filters?: TFilter[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search', value: string, filters: TFilter[]): void
  (e: 'showFilter', event: Event): void
  (e: 'removeFilter', filter: TFilter): void
}>()

const emitSearch = debounce((value: string) => {
  emit('search', value, filters)
}, debounceTime)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emitSearch(target.value)
}

const clearSearch = () => {
  emit('update:modelValue', '')
  emitSearch('')
}
</script>

<style scoped>
:deep(.p-inputtext) {
  --p-form-field-padding-x: 0.625rem;
}

.p-button.p-inputicon {
  @apply p-0 w-auto border-none;
}
</style>
