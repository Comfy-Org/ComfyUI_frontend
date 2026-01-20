<template>
  <div
    :class="
      cn(
        'relative flex w-full cursor-text items-center gap-2 bg-comfy-input text-comfy-input-foreground',
        customClass,
        wrapperStyle
      )
    "
  >
    <InputText
      ref="inputRef"
      v-model="modelValue"
      :placeholder
      :autofocus
      unstyled
      class="absolute inset-0 size-full border-none bg-transparent pl-11 text-sm outline-none"
      :aria-label="placeholder"
    />
    <Button
      v-if="filterIcon"
      size="icon"
      variant="textonly"
      class="filter-button absolute inset-y-0 right-0 m-0 p-0"
      @click="$emit('showFilter', $event)"
    >
      <i :class="filterIcon" />
    </Button>
    <InputIcon
      v-if="!modelValue"
      :class="icon"
    />
    <Button
      v-if="modelValue"
      class="clear-button absolute left-0"
      variant="textonly"
      size="icon"
      @click="modelValue = ''"
    >
      <i class="icon-[lucide--x] size-4" />
    </Button>
  </div>
  <div
    v-if="filters?.length"
    class="search-filters flex flex-wrap gap-2 pt-2"
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
</template>

<script setup lang="ts" generic="TFilter extends SearchFilter">
import { cn } from '@comfyorg/tailwind-utils'
import { watchDebounced } from '@vueuse/core'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import type { SearchFilter } from './SearchFilterChip.vue'
import SearchFilterChip from './SearchFilterChip.vue'

const {
  placeholder = 'Search...',
  icon = 'pi pi-search',
  debounceTime = 300,
  filterIcon,
  filters = [],
  autofocus = false,
  showBorder = false,
  size = 'md',
  class: customClass
} = defineProps<{
  placeholder?: string
  icon?: string
  debounceTime?: number
  filterIcon?: string
  filters?: TFilter[]
  autofocus?: boolean
  showBorder?: boolean
  size?: 'md' | 'lg'
  class?: string
}>()

const emit = defineEmits<{
  (e: 'search', value: string, filters: TFilter[]): void
  (e: 'showFilter', event: Event): void
  (e: 'removeFilter', filter: TFilter): void
}>()

const modelValue = defineModel<string>({ required: true })

const inputRef = ref()

defineExpose({
  focus: () => {
    inputRef.value?.$el?.focus()
  }
})

watchDebounced(
  modelValue,
  (value: string) => {
    emit('search', value, filters)
  },
  { debounce: debounceTime }
)

const wrapperStyle = computed(() => {
  if (showBorder) {
    return cn('rounded border border-solid border-border-default p-2')
  }

  // Size-specific classes matching button sizes for consistency
  const sizeClasses = {
    md: 'h-8 px-2 py-1.5', // Matches button sm size
    lg: 'h-10 px-4 py-2' // Matches button md size
  }[size]

  return cn('rounded-lg', sizeClasses)
})
</script>

<style scoped>
@reference '../../assets/css/style.css';

:deep(.p-inputtext) {
  --p-form-field-padding-x: 0.625rem;
}
</style>
