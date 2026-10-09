<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { StatusTone } from './status'

/**
 * A state and its name, the way the developer platform marks one: the dot
 * carries the tone and the word keeps the row's colour, except a failure,
 * which turns its word red so it is findable at a glance.
 */
const { tone, label } = defineProps<{ tone: StatusTone; label: string }>()
const dot: Record<StatusTone, string> = {
  success: 'bg-admin-success',
  warning: 'bg-admin-warning',
  danger: '',
  info: 'bg-admin-info',
  muted: 'bg-admin-subtle'
}
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex min-w-0 items-center gap-2 text-xs whitespace-nowrap',
        tone === 'danger' && 'text-admin-danger-text',
        tone === 'muted' && 'text-admin-muted'
      )
    "
  >
    <TriangleAlert
      v-if="tone === 'danger'"
      class="size-3 shrink-0"
      aria-hidden="true"
    />
    <span
      v-else
      :class="cn('size-2 shrink-0 rounded-full', dot[tone])"
      aria-hidden="true"
    />
    <span class="truncate">{{ label }}</span>
  </span>
</template>
