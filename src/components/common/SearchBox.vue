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
</style>
