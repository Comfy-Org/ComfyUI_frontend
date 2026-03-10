<template>
  <SelectRoot v-model="selectedItem" :disabled>
    <SelectTrigger
      :class="
        cn(
          'relative inline-flex cursor-pointer items-center select-none',
          size === 'md' ? 'h-8' : 'h-10',
          'rounded-lg',
          'bg-secondary-background text-base-foreground',
          'transition-all duration-200 ease-in-out',
          'hover:bg-secondary-background-hover',
          'border-[2.5px] border-solid',
          invalid
            ? 'border-destructive-background'
            : 'border-transparent focus:border-node-component-border',
          'focus:outline-none',
          'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-secondary-background'
        )
      "
      :aria-label="label || t('g.singleSelectDropdown')"
      :aria-busy="loading || undefined"
      :aria-invalid="invalid || undefined"
    >
      <div
        :class="
          cn(
            'flex flex-1 items-center gap-2 whitespace-nowrap',
            size === 'md' ? 'pl-3 text-xs' : 'pl-4 text-sm'
          )
        "
      >
        <i
          v-if="loading"
          class="icon-[lucide--loader-circle] animate-spin text-muted-foreground"
        />
        <slot v-else name="icon" />
        <SelectValue :placeholder="label" />
      </div>
      <SelectIcon v-if="!loading" as-child>
        <i
          class="icon-[lucide--chevron-down] shrink-0 px-3 text-muted-foreground"
        />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :class="
          cn(
            'z-3000 mt-2 rounded-lg p-2',
            'bg-base-background text-base-foreground',
            'border border-solid border-border-default',
            'shadow-md',
            'data-[state=closed]:animate-out data-[state=open]:animate-in',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2'
          )
        "
      >
        <SelectViewport
          :style="viewportStyle"
          class="flex scrollbar-custom flex-col gap-0"
        >
          <SelectItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            :class="
              cn(
                'flex w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-3 text-sm outline-none select-none',
                'hover:bg-secondary-background-hover',
                'focus:bg-secondary-background-hover',
                'data-[state=checked]:bg-secondary-background-selected',
                'data-[state=checked]:hover:bg-secondary-background-selected'
              )
            "
          >
            <SelectItemText class="truncate">
              {{ option.name }}
            </SelectItemText>
            <SelectItemIndicator>
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
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import type { SelectOption } from './types'

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

const viewportStyle = computed(() => {
  const styles: Record<string, string> = {
    maxHeight: `min(${listMaxHeight}, 50vh)`
  }
  if (popoverMinWidth) styles.minWidth = popoverMinWidth
  if (popoverMaxWidth) styles.maxWidth = popoverMaxWidth
  return styles
})
</script>
