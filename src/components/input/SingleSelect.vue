<template>
  <SelectRoot v-model="selectedItem" :disabled>
    <SelectTrigger
      v-bind="$attrs"
      :aria-label="label || t('g.singleSelectDropdown')"
      :aria-busy="loading || undefined"
      :aria-invalid="invalid || undefined"
      :class="
        cn(
          'relative inline-flex cursor-pointer items-center select-none',
          size === 'md' ? 'h-8' : 'h-10',
          'rounded-lg',
          'bg-secondary-background text-base-foreground',
          'transition-all duration-200 ease-in-out',
          'hover:bg-secondary-background-hover',
          'border-[2.5px] border-solid',
          invalid ? 'border-destructive-background' : 'border-transparent',
          'focus:border-node-component-border focus:outline-none',
          'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-secondary-background'
        )
      "
    >
      <div
        :class="
          cn(
            'flex flex-1 items-center gap-2 overflow-hidden py-2',
            size === 'md' ? 'pl-3 text-xs' : 'pl-4 text-sm'
          )
        "
      >
        <i
          v-if="loading"
          class="icon-[lucide--loader-circle] shrink-0 animate-spin text-muted-foreground"
        />
        <slot v-else name="icon" />
        <SelectValue :placeholder="label" class="truncate" />
      </div>
      <div
        class="flex shrink-0 cursor-pointer items-center justify-center px-3"
      >
        <i class="icon-[lucide--chevron-down] text-muted-foreground" />
      </div>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="8"
        align="start"
        :style="optionStyle"
        :class="
          cn(
            'z-3000 overflow-hidden',
            'rounded-lg p-2',
            'bg-base-background text-base-foreground',
            'border border-solid border-border-default',
            'shadow-md',
            'min-w-(--reka-select-trigger-width)',
            'data-[state=closed]:animate-out data-[state=open]:animate-in',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2'
          )
        "
      >
        <SelectViewport
          :style="{ maxHeight: `min(${listMaxHeight}, 50vh)` }"
          class="scrollbar-custom w-full"
        >
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            :class="
              cn(
                'relative flex w-full cursor-pointer items-center justify-between select-none',
                'gap-3 rounded-sm px-2 py-3 text-sm outline-none',
                'hover:bg-secondary-background-hover',
                'focus:bg-secondary-background-hover',
                'data-[state=checked]:bg-secondary-background-selected',
                'data-[state=checked]:hover:bg-secondary-background-selected'
              )
            "
          >
            <SelectItemText class="truncate">
              {{ opt.name }}
            </SelectItemText>
            <SelectItemIndicator
              class="flex shrink-0 items-center justify-center"
            >
              <i
                class="icon-[lucide--check] text-base-foreground"
                aria-hidden="true"
              />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

import { usePopoverSizing } from '@/composables/usePopoverSizing'
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
  disabled = false,
  listMaxHeight = '28rem',
  popoverMinWidth,
  popoverMaxWidth
} = defineProps<{
  label?: string
  options?: SelectOption[]
  /** Trigger size: 'lg' (40px, Interface) or 'md' (32px, Node) */
  size?: 'lg' | 'md'
  /** Show invalid (destructive) border */
  invalid?: boolean
  /** Show loading spinner instead of chevron */
  loading?: boolean
  /** Disable the select */
  disabled?: boolean
  /** Maximum height of the dropdown panel (default: 28rem) */
  listMaxHeight?: string
  /** Minimum width of the popover (default: auto) */
  popoverMinWidth?: string
  /** Maximum width of the popover (default: auto) */
  popoverMaxWidth?: string
}>()

const selectedItem = defineModel<string | undefined>({ required: true })

const { t } = useI18n()

const optionStyle = usePopoverSizing({
  minWidth: popoverMinWidth,
  maxWidth: popoverMaxWidth
})
</script>
