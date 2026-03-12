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
    :pt="{
      root: ({ props }: SelectPassThroughMethodOptions<SelectOption>) => ({
        class: cn(
          'relative inline-flex cursor-pointer items-center select-none',
          size === 'md' ? 'h-8' : 'h-10',
          'rounded-lg',
          'bg-secondary-background text-base-foreground',
          'transition-all duration-200 ease-in-out',
          'hover:bg-secondary-background-hover',
          'border-[2.5px] border-solid',
          invalid
            ? 'border-destructive-background'
            : 'border-transparent focus-within:border-node-component-border',
          props.disabled &&
            'cursor-default opacity-30 hover:bg-secondary-background'
        )
      }),
      label: {
        class: cn(
          'flex flex-1 items-center py-2 whitespace-nowrap outline-hidden',
          size === 'md' ? 'pl-3' : 'pl-4'
        )
      },
      dropdown: {
        class:
          // Right chevron touch area
          'flex shrink-0 items-center justify-center px-3 py-2'
      },
      overlay: {
        class: cn(
          'mt-2 rounded-lg p-2',
          'bg-base-background text-base-foreground',
          'border border-solid border-border-default'
        )
      },
      listContainer: () => ({
        style: `max-height: min(${listMaxHeight}, 50vh)`,
        class: 'scrollbar-custom'
      }),
      list: {
        class:
          // Same list tone/size as MultiSelect
          'flex flex-col gap-0 p-0 m-0 list-none border-none text-sm'
      },
      option: ({ context }: SelectPassThroughMethodOptions<SelectOption>) => ({
        class: cn(
          // Row layout
          'flex items-center justify-between gap-3 rounded-sm px-2 py-3',
          'hover:bg-secondary-background-hover',
          // Add focus state for keyboard navigation
          context.focused && 'bg-secondary-background-hover',
          // Selected state + check icon
          context.selected &&
            'bg-secondary-background-selected hover:bg-secondary-background-selected'
        )
      }),
      optionLabel: {
        class: 'truncate'
      },
      optionGroupLabel: {
        class: 'px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground'
      },
      emptyMessage: {
        class: 'px-3 py-2 text-sm text-muted-foreground'
      }
    }"
    :aria-label="label || t('g.singleSelectDropdown')"
    :aria-busy="loading || undefined"
    :aria-invalid="invalid || undefined"
    role="combobox"
    :aria-expanded="false"
    aria-haspopup="listbox"
    :tabindex="0"
  >
    <!-- Trigger value -->
    <template #value="slotProps">
      <div
        :class="
          cn('flex items-center gap-2', size === 'md' ? 'text-xs' : 'text-sm')
        "
      >
        <i
          v-if="loading"
          class="icon-[lucide--loader-circle] animate-spin text-muted-foreground"
        />
        <slot v-else name="icon" />
        <span
          v-if="slotProps.value !== null && slotProps.value !== undefined"
          class="text-base-foreground"
        >
          {{ getLabel(slotProps.value) }}
        </span>
        <span v-else class="text-base-foreground">
          {{ label }}
        </span>
      </div>
    </template>

    <!-- Trigger caret (hidden when loading) -->
    <template #dropdownicon>
      <i
        v-if="!loading"
        class="icon-[lucide--chevron-down] text-muted-foreground"
      />
    </template>

    <!-- Option row -->
    <template #option="{ option, selected }">
      <div
        class="flex w-full items-center justify-between gap-3"
        :style="optionStyle"
      >
        <span class="truncate">{{ option.name }}</span>
        <i v-if="selected" class="icon-[lucide--check] text-base-foreground" />
      </div>
    </template>
  </Select>
</template>

<script setup lang="ts">
import type { SelectPassThroughMethodOptions } from 'primevue/select'
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import type { SelectOption } from './types'

defineOptions({
  inheritAttrs: false
})

const {
  label,
  options,
  size = 'lg',
  invalid = false,
  loading = false,
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth
} = defineProps<{
  label?: string
  /**
   * Required for displaying the selected item's label.
   * Cannot rely on $attrs alone because we need to access options
   * in getLabel() to map values to their display names.
   */
  options?: SelectOption[]
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Show invalid (destructive) border */
  invalid?: boolean
  /** Show loading spinner instead of chevron */
  loading?: boolean
  /** Maximum height of the dropdown panel (default: 28rem) */
  listMaxHeight?: string
  /** Minimum width of the popover (default: auto) */
  popoverMinWidth?: string
  /** Maximum width of the popover (default: auto) */
  popoverMaxWidth?: string
}>()

const selectedItem = defineModel<string | undefined>({ required: true })

const { t } = useI18n()

/**
 * Maps a value to its display label.
 * Necessary because PrimeVue's value slot doesn't provide the selected item's label,
 * only the raw value. We need this to show the correct text when an item is selected.
 */
const getLabel = (val: string | null | undefined) => {
  if (val == null) return label ?? ''
  if (!options) return label ?? ''
  const found = options.find((o) => o.value === val)
  return found ? found.name : (label ?? '')
}

// Extract complex style logic from template
const optionStyle = computed(() => {
  if (!popoverMinWidth && !popoverMaxWidth) return undefined

  const styles: string[] = []
  if (popoverMinWidth) styles.push(`min-width: ${popoverMinWidth}`)
  if (popoverMaxWidth) styles.push(`max-width: ${popoverMaxWidth}`)

  return styles.join('; ')
})
</script>
