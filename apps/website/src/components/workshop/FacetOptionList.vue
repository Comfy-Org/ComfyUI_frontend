<script setup lang="ts">
import { Check } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { FacetSheetGroup } from './FacetSheet.vue'

const { group, options, noMatches } = defineProps<{
  group: FacetSheetGroup
  options: FacetSheetGroup['options']
  noMatches: string
}>()

const emit = defineEmits<{ toggle: [group: string, value: string] }>()
</script>

<template>
  <ul :aria-label="group.label">
    <li v-for="option in options" :key="option.value">
      <button
        type="button"
        :aria-pressed="group.selected.includes(option.value)"
        :data-testid="`filter-${group.key}-${option.value}`"
        class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs text-content-secondary transition-colors outline-none hover:bg-white/5 hover:text-content focus-visible:bg-white/5 max-sm:py-2.5 max-sm:text-sm"
        @click="emit('toggle', group.key, option.value)"
      >
        <span
          :class="
            cn(
              'flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors',
              group.selected.includes(option.value)
                ? 'border-brand bg-brand text-page'
                : 'border-white/25'
            )
          "
          aria-hidden="true"
        >
          <Check
            v-if="group.selected.includes(option.value)"
            class="size-3"
            :stroke-width="3"
          />
        </span>
        <span class="flex-1 truncate">{{ option.label }}</span>
        <span class="shrink-0 text-content/30 tabular-nums">
          {{ option.count }}
        </span>
      </button>
    </li>
    <li
      v-if="!options.length"
      class="px-3 py-2 text-xs text-content-muted max-sm:py-10 max-sm:text-center max-sm:text-sm"
    >
      {{ noMatches }}
    </li>
  </ul>
</template>
