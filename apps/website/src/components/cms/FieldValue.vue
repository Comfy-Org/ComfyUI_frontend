<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import QueueThumb from '@/components/cms/QueueThumb.vue'
import { formatValue, mediaOf } from '@/lib/cms/format'

/** One side of a field change: an image, a list with what was added, or text. */
const {
  value,
  side,
  added = [],
  empty
} = defineProps<{
  value: unknown
  side: 'before' | 'after'
  added?: unknown[]
  empty: string
}>()
const media = mediaOf(value)
const list = side === 'after' && Array.isArray(value) && added.length > 0
const items: unknown[] = list && Array.isArray(value) ? value : []
</script>

<template>
  <dd v-if="media">
    <QueueThumb
      :src="media"
      :class="cn('w-40', side === 'before' && 'opacity-70')"
    />
  </dd>
  <dd v-else-if="list" class="flex flex-wrap gap-1 wrap-break-word">
    <span
      v-for="(entry, i) in items"
      :key="i"
      :class="
        cn(
          'rounded-sm px-1',
          added.includes(entry)
            ? 'bg-admin-success/15 text-admin-success'
            : 'bg-admin-hover'
        )
      "
      >{{ formatValue(entry) }}</span
    >
  </dd>
  <dd
    v-else
    :class="
      cn(
        'wrap-break-word',
        side === 'before' &&
          'text-admin-muted line-through decoration-admin-danger-text/50'
      )
    "
  >
    {{ formatValue(value) || empty }}
  </dd>
</template>
