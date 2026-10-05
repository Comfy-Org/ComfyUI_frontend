<template>
  <ComboboxAnchor as-child>
    <ComboboxTrigger
      v-bind="$attrs"
      :aria-label="label || fallbackLabel"
      :class="
        cn(
          selectTriggerVariants({
            size,
            border: selectedItems.length ? 'active' : 'none'
          }),
          className
        )
      "
    >
      <div
        class="flex flex-1 items-center overflow-hidden py-2 pl-2 whitespace-nowrap"
      >
        <span
          v-if="selectedItems.length === 0"
          :class="size === 'md' ? 'text-xs' : 'text-sm'"
        >
          {{ label }}
        </span>
        <slot v-else :selected="selectedItems">
          <span class="truncate text-sm">
            {{ selectedItems.map(({ name }) => name).join(', ') }}
          </span>
        </slot>
        <span
          v-if="selectedItems.length"
          :class="
            cn(
              'pointer-events-none absolute -top-1.5 -right-1.5 z-10',
              selectCountBadgeClass
            )
          "
        >
          {{ selectedItems.length }}
        </span>
      </div>
      <div :class="selectDropdownClass">
        <i class="icon-[lucide--chevron-down] text-muted-foreground" />
      </div>
    </ComboboxTrigger>
  </ComboboxAnchor>
</template>

<script setup lang="ts">
import { ComboboxAnchor, ComboboxTrigger } from 'reka-ui'

import {
  selectCountBadgeClass,
  selectDropdownClass,
  selectTriggerVariants
} from '@comfyorg/design-system/select.variants'
import { cn } from '@comfyorg/tailwind-utils'
import type { ClassValue } from '@comfyorg/tailwind-utils'
import type { SelectOption } from '@/components/ui/select/types'

defineOptions({ inheritAttrs: false })

const {
  class: className,
  label,
  fallbackLabel,
  selectedItems,
  size
} = defineProps<{
  class?: ClassValue
  label?: string
  fallbackLabel: string
  selectedItems: SelectOption[]
  size: 'lg' | 'md'
}>()
</script>
