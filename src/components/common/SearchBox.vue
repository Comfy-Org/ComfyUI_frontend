<template>
  <div :class="props.class">
    <IconField>
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
        class="p-inputicon"
        :icon="props.filterIcon"
        text
        severity="contrast"
        @click="$emit('showFilter', $event)"
      />
    </IconField>
    <div class="search-filters" v-if="filters">
      <SearchFilterChip
        v-for="filter in filters"
        :key="filter.id"
        :text="filter.text"
        :badge="filter.badge"
        :badge-class="filter.badgeClass"
        @remove="onFilterRemoved(filter)"
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

interface Props {
  class?: string
  modelValue: string
  placeholder?: string
  icon?: string
  debounceTime?: number
  filterIcon?: string
  filters?: TFilter[]
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search...',
  icon: 'pi pi-search',
  debounceTime: 300
})

const { filters } = toRefs(props)

const emit = defineEmits([
  'update:modelValue',
  'search',
  'showFilter',
  'filterRemoved'
])

const emitSearch = debounce((value: string) => {
  emit('search', value, props.filters)
}, props.debounceTime)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
  emitSearch(target.value)
}

const onFilterRemoved = (filter) => {
  const index = props.filters.findIndex((f) => f === filter)
  if (index !== -1) {
    props.filters.splice(index, 1)
    emit('filterRemoved', filter)
  }
}
</script>

<style scoped>
.search-box-input {
  width: 100%;
  padding-left: 36px;
}

.search-box-input.with-filter {
  padding-right: 36px;
}

.p-button.p-inputicon {
  padding: 0;
  width: auto;
  border: none !important;
}

.search-filters {
  @apply pt-2 flex flex-wrap gap-2;
}
</style>
