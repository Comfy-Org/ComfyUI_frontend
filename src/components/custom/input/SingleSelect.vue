<template>
  <div class="relative inline-flex items-center">
    <Select
      v-model="selectedItem"
      :options="props.options"
      option-label="name"
      unstyled
      :placeholder="props.label"
      :pt="pt"
    >
      <template #value="slotProps">
        <div class="flex items-center gap-2">
          <slot name="label-icon" />
          <span
            v-if="slotProps.value"
            class="text-sm text-zinc-700 dark-theme:text-gray-200"
          >
            {{ slotProps.value.name }}
          </span>
          <span v-else class="text-sm text-zinc-400 dark-theme:text-gray-500">
            {{ props.label }}
          </span>
        </div>
      </template>
      <template #dropdownicon>
        <i-lucide:chevron-down class="text-lg text-neutral-400" />
      </template>
      <template #option="slotProps">
        <span>{{ slotProps.option.name }}</span>
      </template>
    </Select>
  </div>
</template>

<script setup lang="ts">
import Select, { SelectPassThroughMethodOptions } from 'primevue/select'
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
  label: 'Select an option'
})

const selectedItem = defineModel<Option | null>({ required: true })

const pt = computed(() => ({
  root: ({ props, state }: SelectPassThroughMethodOptions<Option>) => ({
    class: [
      'relative inline-flex cursor-pointer select-none w-full border border-solid border-transparent',
      'rounded-lg text-neutral dark-theme:text-white',
      'transition-all duration-200 ease-in-out',
      { 'opacity-60 cursor-default': props.disabled },
      {
        'border-zinc-300 dark-theme:border-zinc-800': state.overlayVisible
      }
    ]
  }),
  label: {
    class:
      'flex-1 flex items-center cursor-pointer overflow-hidden whitespace-nowrap pl-3 py-2'
  },
  dropdown: {
    class: 'flex shrink-0 cursor-pointer items-center justify-center px-3'
  },
  list: {
    class:
      'flex flex-col gap-1 p-0 list-none bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white border-none text-xs'
  },
  overlay:
    'mt-2 bg-white dark-theme:bg-zinc-800 text-neutral dark-theme:text-white rounded-lg',
  option:
    'flex gap-1 items-center py-2 px-3 text-neutral hover:bg-neutral-100/50 dark-theme:hover:bg-zinc-700/50'
}))
</script>

<style scoped>
/* Hide default radio buttons */
:deep(.p-radiobutton),
:deep(.p-radiobutton-box),
:deep(.p-radiobutton-icon),
:deep([data-pc-section='pcOptionRadiobutton']),
:deep([data-pc-section='optionRadiobutton']),
:deep([data-pc-section='radiobutton']) {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Adjust option padding since radio button is removed */
:deep(.p-select-option) {
  padding-left: 0.5rem !important;
}
</style>
