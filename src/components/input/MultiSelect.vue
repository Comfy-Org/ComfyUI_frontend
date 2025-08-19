<template>
  <div class="relative inline-block">
    <MultiSelect
      v-model="selectedItems"
      :options="options"
      option-label="name"
      unstyled
      :placeholder="label"
      :max-selected-labels="0"
      :pt="pt"
    >
      <!-- Trigger value (keep text scale identical) -->
      <template #value>
        <span class="text-sm text-zinc-700 dark-theme:text-gray-200">
          {{ label }}
        </span>
      </template>

      <!-- Chevron size identical to current -->
      <template #dropdownicon>
        <i-lucide:chevron-down class="text-lg text-neutral-400" />
      </template>

      <!-- Custom option row: square checkbox + label (unchanged layout/colors) -->
      <template #option="slotProps">
        <div class="flex items-center gap-2">
          <div
            class="flex h-4 w-4 p-0.5 flex-shrink-0 items-center justify-center rounded border-[3px] transition-all duration-200"
            :class="
              slotProps.selected
                ? 'border-blue-400 bg-blue-400 dark-theme:border-blue-500 dark-theme:bg-blue-500'
                : 'border-neutral-300 dark-theme:border-zinc-600 bg-neutral-100 dark-theme:bg-zinc-700'
            "
          >
            <i-lucide:check
              v-if="slotProps.selected"
              class="text-xs text-bold text-white"
            />
          </div>
          <span>{{ slotProps.option.name }}</span>
        </div>
      </template>
    </MultiSelect>

    <!-- Selected count badge (unchanged) -->
    <div
      v-if="selectedCount > 0"
      class="pointer-events-none absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-400 dark-theme:bg-blue-500 text-xs font-semibold text-white"
    >
      {{ selectedCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
import MultiSelect, {
  MultiSelectPassThroughMethodOptions
} from 'primevue/multiselect'
import { computed } from 'vue'

const { label, options } = defineProps<{
  label?: string
  options: { name: string; value: string }[]
}>()

const selectedItems = defineModel<{ name: string; value: string }[]>({
  required: true
})

const selectedCount = computed(() => selectedItems.value.length)

/**
 * Pure unstyled mode using only the PrimeVue PT API.
 * All PrimeVue built-in checkboxes/headers are hidden via PT (no :deep hacks).
 * Visual output matches the previous version exactly.
 */
const pt = computed(() => ({
  root: ({ props }: MultiSelectPassThroughMethodOptions) => ({
    class: [
      'relative inline-flex cursor-pointer select-none w-full',
      'rounded-lg bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white',
      'transition-all duration-200 ease-in-out',
      'border-[2.5px] border-solid',
      selectedCount.value > 0
        ? 'border-blue-400 dark-theme:border-blue-500'
        : 'border-transparent',
      { 'opacity-60 cursor-default': props.disabled }
    ]
  }),
  labelContainer: {
    class:
      'flex-1 flex items-center overflow-hidden whitespace-nowrap pl-4 py-2 '
  },
  label: {
    class: 'p-0'
  },
  dropdown: {
    class: 'flex shrink-0 cursor-pointer items-center justify-center px-3'
  },
  header: { class: 'hidden' },

  // Overlay & list visuals unchanged
  overlay:
    'mt-2 bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white rounded-lg border border-solid border-zinc-100',
  list: {
    class: 'flex flex-col gap-1 p-0 list-none border-none text-xs'
  },

  // Option row hover tone identical
  option:
    'flex gap-1 items-center p-2 hover:bg-neutral-100/50 dark-theme:hover:bg-zinc-700/50',

  // Hide built-in checkboxes entirely via PT (no :deep)
  pcHeaderCheckbox: {
    root: { class: 'hidden' },
    style: 'display: none !important'
  },
  pcOptionCheckbox: {
    root: { class: 'hidden' },
    style: 'display: none !important'
  }
}))
</script>
