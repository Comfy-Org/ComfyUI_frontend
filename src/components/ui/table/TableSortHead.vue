<template>
  <TableHead :class="className" :aria-sort="direction ?? 'none'">
    <button
      type="button"
      class="flex items-center gap-1 rounded-sm outline-none hover:text-base-foreground focus-visible:ring-1 focus-visible:ring-border-default"
      @click="toggle"
    >
      <slot />
      <i
        v-if="direction"
        :class="
          cn(
            'size-4',
            direction === 'ascending'
              ? 'icon-[lucide--arrow-up]'
              : 'icon-[lucide--arrow-down]'
          )
        "
        aria-hidden="true"
      />
    </button>
  </TableHead>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import TableHead from './TableHead.vue'
import type { TableSortDirection } from './tableUtils'

const { class: className } = defineProps<{ class?: HTMLAttributes['class'] }>()

const direction = defineModel<TableSortDirection | null>('direction', {
  default: null
})

function toggle() {
  direction.value = direction.value === 'ascending' ? 'descending' : 'ascending'
}
</script>
