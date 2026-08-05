<script setup lang="ts">
import type { SelectOption } from '@/components/ui/select/types'
import { cn } from '@comfyorg/tailwind-utils'

import type { FilterMenuFacet } from './TemplatesFilterMenu.vue'

/**
 * The mark in front of a filter value. Multi-select facets get a checkbox so
 * "you can pick several" is legible before the first click; single-select
 * ones get a tick, which is what picking one of many looks like everywhere
 * else. Shared so the search results and the submenu can never disagree.
 */
const { facet, option } = defineProps<{
  facet: FilterMenuFacet
  option: SelectOption
}>()

const isSelected = () =>
  facet.selectedValues.includes(option.value) &&
  option.value !== facet.emptyValue
</script>

<template>
  <span
    v-if="facet.mode === 'multiple'"
    :class="
      cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm transition-colors duration-200',
        isSelected() ? 'bg-primary-background' : 'bg-secondary-background'
      )
    "
  >
    <i
      v-if="isSelected()"
      class="icon-[lucide--check] text-xs font-bold text-base-foreground"
    />
  </span>
  <i
    v-else
    :class="
      cn(
        'icon-[lucide--check] size-4 shrink-0',
        isSelected() ? 'opacity-100' : 'opacity-0'
      )
    "
  />
</template>
