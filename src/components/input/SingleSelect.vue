<template>
  <!-- 
    Note: We explicitly pass options here (not just via $attrs) because:
    1. Our custom value template needs options to look up labels from values
    2. PrimeVue's value slot only provides 'value' and 'placeholder', not the selected item's label
    3. We need to maintain the icon slot functionality in the value template
    
    option-label="name" is required because our option template directly accesses option.name
  -->
  <Select
    v-model="selectedItem"
    v-bind="$attrs"
    :options="options"
    option-label="name"
    option-value="value"
    unstyled
    :pt="pt"
  >
    <!-- Trigger value -->
    <template #value="slotProps">
      <div class="flex items-center gap-2 text-sm">
        <slot name="icon" />
        <span
          v-if="slotProps.value !== null && slotProps.value !== undefined"
          class="text-zinc-700 dark-theme:text-gray-200"
        >
          {{ getLabel(slotProps.value) }}
        </span>
        <span v-else class="text-zinc-700 dark-theme:text-gray-200">
          {{ label }}
        </span>
      </div>
    </template>

    <!-- Trigger caret -->
    <template #dropdownicon>
      <i-lucide:chevron-down
        class="text-base text-neutral-400 dark-theme:text-gray-300"
      />
    </template>

    <!-- Option row -->
    <template #option="{ option, selected }">
      <div class="flex items-center justify-between gap-3 w-full">
        <span class="truncate">{{ option.name }}</span>
        <i-lucide:check
          v-if="selected"
          class="text-neutral-900 dark-theme:text-white"
        />
      </div>
    </template>
  </Select>
</template>

<script setup lang="ts">
import Select, { SelectPassThroughMethodOptions } from 'primevue/select'
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false
})

const { label, options } = defineProps<{
  label?: string
  /**
   * Required for displaying the selected item's label.
   * Cannot rely on $attrs alone because we need to access options
   * in getLabel() to map values to their display names.
   */
  options?: {
    name: string
    value: string
  }[]
}>()

const selectedItem = defineModel<string | null>({ required: true })

/**
 * Maps a value to its display label.
 * Necessary because PrimeVue's value slot doesn't provide the selected item's label,
 * only the raw value. We need this to show the correct text when an item is selected.
 */
const getLabel = (val: string | null | undefined) => {
  if (val == null) return label ?? ''
  if (!options) return label ?? ''
  const found = options.find((o) => o.value === val)
  return found ? found.name : label ?? ''
}

/**
 * Unstyled + PT API only
 * - No background/border (same as page background)
 * - Text/icon scale: compact size matching MultiSelect
 */
const pt = computed(() => ({
  root: ({
    props
  }: SelectPassThroughMethodOptions<{ name: string; value: string }>) => ({
    class: [
      // container
      'relative inline-flex cursor-pointer select-none items-center',
      // trigger surface
      'rounded-md',
      'bg-transparent text-neutral dark-theme:text-white',
      'border-0',
      // disabled
      { 'opacity-60 cursor-default': props.disabled }
    ]
  }),
  label: {
    class:
      // Align with MultiSelect labelContainer spacing
      'flex-1 flex items-center overflow-hidden whitespace-nowrap pl-4 py-2 outline-none'
  },
  dropdown: {
    class:
      // Right chevron touch area
      'flex shrink-0 items-center justify-center px-3 py-2'
  },
  overlay: {
    class: [
      // dropdown panel
      'mt-2 bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white rounded-lg border border-solid border-zinc-100 dark-theme:border-zinc-700'
    ]
  },
  list: {
    class:
      // Same list tone/size as MultiSelect
      'flex flex-col gap-1 p-0 list-none border-none text-xs'
  },
  option: ({
    context
  }: SelectPassThroughMethodOptions<{ name: string; value: string }>) => ({
    class: [
      // Row layout
      'flex items-center justify-between gap-3 px-3 py-2',
      'hover:bg-neutral-100/50 dark-theme:hover:bg-zinc-700/50',
      // Selected state + check icon
      { 'bg-neutral-100/50 dark-theme:bg-zinc-700/50': context.selected },
      // Add focus state for keyboard navigation
      { 'bg-neutral-100/50 dark-theme:bg-zinc-700/50': context.focused }
    ]
  }),
  optionLabel: {
    class: 'truncate'
  },
  optionGroupLabel: {
    class:
      'px-3 py-2 text-xs uppercase tracking-wide text-zinc-500 dark-theme:text-zinc-400'
  },
  emptyMessage: {
    class: 'px-3 py-2 text-sm text-zinc-500 dark-theme:text-zinc-400'
  }
}))
</script>
