<template>
  <div :class="props.class">
    <IconField>
      <Button
        v-if="props.filterIcon"
        class="p-inputicon filter-button"
        :icon="props.filterIcon"
        text
        severity="contrast"
        @click="$emit('showFilter', $event)"
      />
      <InputText
        class="search-box-input w-full"
        @input="handleInput"
        :modelValue="props.modelValue"
        :placeholder="props.placeholder"
      />
      <InputIcon v-if="!props.modelValue" :class="props.icon" />
      <Button
        v-if="props.modelValue"
        class="p-inputicon clear-button"
        icon="pi pi-times"
        text
        severity="contrast"
        @click="clearSearch"
      />
    </IconField>
    <div
      class="search-filters pt-2 flex flex-wrap gap-2"
      v-if="filters?.length"
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
import { toRefs } from 'vue'

import type { SearchFilter } from './SearchFilterChip.vue'
import SearchFilterChip from './SearchFilterChip.vue'

const props = withDefaults(
  defineProps<{
    class?: string
    modelValue: string
    placeholder?: string
    icon?: string
    debounceTime?: number
    filterIcon?: string
    filters?: TFilter[]
  }>(),
  {
    placeholder: 'Search...',
    icon: 'pi pi-search',
    debounceTime: 300
  }
)

const { filters } = toRefs(props)

const emit = defineEmits([
  'update:modelValue',
  'search',
  'showFilter',
  'removeFilter'
])

const emitSearch = debounce((value: string) => {
  emit('search', value, props.filters)
}, props.debounceTime)

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
