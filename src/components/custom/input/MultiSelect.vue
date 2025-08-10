<template>
  <div class="relative inline-block">
    <MultiSelect
      v-model="selectedItems"
      :options="props.options"
      option-label="name"
      unstyled
      :placeholder="props.label"
      :max-selected-labels="0"
      :pt="pt"
    >
      <template #value>
        <span class="text-sm text-zinc-700 dark-theme:text-gray-200">
          {{ props.label }}
        </span>
      </template>
      <template #dropdownicon>
        <i-lucide:chevron-down class="text-lg text-neutral-500" />
      </template>
      <template #option="slotProps">
        <div class="flex items-center gap-2">
          <div
            class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-all duration-200"
            :class="
              slotProps.selected
                ? 'border-blue-500 bg-blue-500'
                : 'border-neutral-300 dark-theme:border-zinc-600 bg-neutral-100 dark-theme:bg-zinc-700 hover:border-blue-400'
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

    <div
      v-if="selectedCount > 0"
      class="pointer-events-none absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white"
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

interface Option {
  name: string
  value: string
}

interface Props {
  label?: string
  options: Option[]
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Category Label'
})

const selectedItems = defineModel<Option[]>({ required: true })

const selectedCount = computed(() => selectedItems.value.length)

const pt = computed(() => ({
  root: ({ props }: MultiSelectPassThroughMethodOptions) => ({
    class: [
      'relative inline-flex cursor-pointer select-none w-full',
      'rounded-lg bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white',
      'transition-all duration-200 ease-in-out',
      'border-2.5 border-solid',
      selectedCount.value > 0 ? 'border-blue-500' : 'border-transparent',
      { 'opacity-60 cursor-default': props.disabled }
    ]
  }),
  labelContainer: {
    class:
      'flex-1 flex items-center cursor-pointer overflow-hidden whitespace-nowrap pl-4 py-2 '
  },
  label: {
    class: 'p-0'
  },
  dropdown: {
    class: 'flex shrink-0 cursor-pointer items-center justify-center px-3'
  },
  header: { class: 'hidden' },
  list: {
    class:
      'flex flex-col gap-1 p-0 list-none bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white border-none text-xs'
  },
  overlay:
    'mt-2 bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white rounded-lg',
  option:
    'flex gap-1 items-center p-2 text-neutral hover:bg-neutral-100/50 dark-theme:hover:bg-zinc-700/50',
  pcHeaderCheckbox: {
    root: { class: 'hidden' },
    style: 'display: none !important'
  },
  pcOptionCheckbox: {
    root: { class: 'hidden' },
    checkbox: { class: 'hidden' },
    style: 'display: none !important'
  },
  optionCheckbox: {
    class: 'hidden',
    style: 'display: none !important'
  },
  optionCheckboxContainer: {
    class: 'hidden',
    style: 'display: none !important'
  }
}))
</script>

<style scoped>
/* Hide all checkbox elements */
:deep(.p-checkbox),
:deep(.p-checkbox-box),
:deep(.p-checkbox-icon),
:deep(.p-multiselect-option-checkbox),
:deep(.p-multiselect-header-checkbox),
:deep(.p-multiselect-checkbox),
:deep([data-pc-section='pcOptionCheckbox']),
:deep([data-pc-section='optionCheckbox']),
:deep([data-pc-section='checkbox']) {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Adjust option padding since checkbox is removed */
:deep(.p-multiselect-option) {
  padding-left: 0.5rem !important;
}
</style>
