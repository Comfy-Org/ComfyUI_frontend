<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronsUpDown } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { SortKey, SortOrder } from '@/lib/cms/stats'

/** A column heading that sorts by its column; a second click flips the order. */
const {
  column,
  label,
  numeric = false
} = defineProps<{ column: SortKey; label: string; numeric?: boolean }>()
const order = defineModel<SortOrder>({ required: true })

function sort() {
  order.value =
    order.value.key === column
      ? { key: column, descending: !order.value.descending }
      : { key: column, descending: numeric }
}
</script>

<template>
  <th
    scope="col"
    :aria-sort="
      order.key === column
        ? order.descending
          ? 'descending'
          : 'ascending'
        : undefined
    "
    :class="cn('px-3 py-2 font-medium', numeric && 'text-right')"
  >
    <button
      type="button"
      :class="
        cn(
          'inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-admin-fg focus-visible:outline-2 focus-visible:outline-admin-fg',
          order.key === column && 'text-admin-fg'
        )
      "
      @click="sort"
    >
      {{ label }}
      <ArrowDown
        v-if="order.key === column && order.descending"
        class="size-3"
        aria-hidden="true"
      />
      <ArrowUp
        v-else-if="order.key === column"
        class="size-3"
        aria-hidden="true"
      />
      <ChevronsUpDown v-else class="size-3 opacity-50" aria-hidden="true" />
    </button>
  </th>
</template>
