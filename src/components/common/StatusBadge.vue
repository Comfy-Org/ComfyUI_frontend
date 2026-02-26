<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { statusBadgeVariants } from './statusBadge.variants'
import type { StatusBadgeVariants } from './statusBadge.variants'

const {
  label,
  severity = 'default',
  variant,
  class: className
} = defineProps<{
  label?: string | number
  severity?: StatusBadgeVariants['severity']
  variant?: StatusBadgeVariants['variant']
  class?: string
}>()
</script>

<template>
  <span
    :class="
      cn(
        statusBadgeVariants({
          severity,
          variant: variant ?? (label == null ? 'dot' : 'label')
        }),
        className
      )
    "
  >
    {{ label }}
  </span>
</template>
