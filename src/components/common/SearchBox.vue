<template>
  <div :class="props.class">
    <IconField
      class="iconfield-relative"
      :class="{ 'with-text': props.modelValue }"
    >
      <InputIcon :class="props.icon" />
      <InputText
        class="search-box-input"
        :class="{ ['with-filter']: props.filterIcon }"
        @input="handleInput"
        :modelValue="props.modelValue"
        :placeholder="props.placeholder"
      />
      <Button
        v-if="props.filterIcon"
        class="p-inputicon filter-button"
        :icon="props.filterIcon"
        text
        severity="contrast"
        @click="$emit('showFilter', $event)"
      />
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
import type { SearchFilter } from './SearchFilterChip.vue'
import { debounce } from 'lodash'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import SearchFilterChip from './SearchFilterChip.vue'
import { toRefs } from 'vue'

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
.iconfield-relative {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box-input {
  width: 100%;
  padding-left: 36px;
  padding-right: 36px;
}

.search-box-input.with-filter {
  padding-right: 72px;
}

.p-button.p-inputicon {
  padding: 0;
  width: auto;
  border: none !important;
}

/* When modelValue is empty (no 'with-text' class), the filter button stays at the far right */
.iconfield-relative:not(.with-text) .filter-button {
  right: 8px;
}

/* When modelValue is not empty ('with-text' class is present), move the filter button to the left */
.iconfield-relative.with-text .filter-button {
  right: 36px;
}

/* When modelValue is not empty (and the clear button is displayed), place the clear button at the far right */
.iconfield-relative.with-text .clear-button {
  right: 8px;
}
</style>
