<script setup lang="ts">
import { computed } from 'vue'

import { statusBadgeVariants } from './statusBadge.variants'
import type { StatusBadgeVariants } from './statusBadge.variants'

const {
  label,
  severity = 'default',
  variant
} = defineProps<{
  label?: string | number
  severity?: StatusBadgeVariants['severity']
  variant?: StatusBadgeVariants['variant']
}>()

const badgeClass = computed(() =>
  statusBadgeVariants({
    severity,
    variant: variant ?? (label == null ? 'dot' : 'label')
  })
)
</script>

<template>
  <span :class="badgeClass">
    {{ label }}
  </span>
</template>
